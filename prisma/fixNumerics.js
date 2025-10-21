const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * fixNumerics.js (debugging version)
 *
 * Usage:
 *  node fixNumerics.js [divisor] [--dry] [--debug]
 *
 * Example:
 *  node fixNumerics.js 10 --debug
 *
 * This script:
 *  - reads code/prisma/schema.prisma
 *  - detects fields of type `Decimal` in each model
 *  - for each field, samples values and counts non-null rows before
 *  - performs an UPDATE dividing the field by `divisor` (default 10)
 *    and uses RETURNING to count affected rows
 *  - samples values and counts after the update
 *
 * Notes:
 *  - Run with --dry to only print SQL that would run.
 *  - Run with --debug for more verbose logs.
 */

async function main() {
  const argv = process.argv.slice(2)
  const divisor = Number(argv[0]) || 10
  const dry = argv.includes('--dry')
  const debug = argv.includes('--debug')
  const minArg = argv.find(a => a.startsWith('--min='))
  const minThreshold = minArg ? Number(minArg.split('=')[1]) : null

  const schemaPath = path.join(__dirname, 'schema.prisma')
  if (!fs.existsSync(schemaPath)) {
    console.error('schema.prisma not found at', schemaPath)
    process.exit(1)
  }

  const schema = fs.readFileSync(schemaPath, 'utf8')
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)^\}/gmi

  const decimalFieldsByModel = {}
  let match
  while ((match = modelRe.exec(schema)) !== null) {
    const modelName = match[1]
    const body = match[2]
    const lines = body.split(/\r?\n/)
    for (const line of lines) {
      const clean = line.replace(/\/\/.*$/, '').trim()
      if (!clean) continue
      const parts = clean.split(/\s+/)
      if (parts.length < 2) continue
      const fieldName = parts[0]
      const fieldType = parts[1]
      if (fieldType === 'Decimal') {
        if (!decimalFieldsByModel[modelName]) decimalFieldsByModel[modelName] = []
        decimalFieldsByModel[modelName].push(fieldName)
      }
    }
  }

  const models = Object.keys(decimalFieldsByModel)
  if (models.length === 0) {
    console.log('No Decimal fields found in schema.prisma. Nothing to do.')
    return
  }

  console.log(`Found Decimal fields in ${models.length} models. Divisor=${divisor} dry=${dry} debug=${debug}`)

  const mapFlag = argv.includes('--map')

  for (const model of models) {
    const fields = decimalFieldsByModel[model]
    console.log(`\nModel ${model}: fields -> ${fields.join(', ')}`)

    for (const f of fields) {
      try {
        const cntSql = `SELECT COUNT(*)::int AS cnt FROM "${model}" WHERE "${f}" IS NOT NULL;`
        const cntBeforeRes = await prisma.$queryRawUnsafe(cntSql)
        const beforeCount = Array.isArray(cntBeforeRes) && cntBeforeRes[0] ? Number(cntBeforeRes[0].cnt) : NaN

        if (mapFlag) {
          // try to find a primary key (id) column sample; fallback to ctid when id absent
          const pkCandidates = ['id', 'ID', 'Id']
          let pk = null
          for (const cand of pkCandidates) {
            try {
              const pkCheck = await prisma.$queryRawUnsafe(`SELECT "${cand}" FROM "${model}" LIMIT 1;`)
              if (Array.isArray(pkCheck) && pkCheck.length > 0) {
                pk = cand
                break
              }
            } catch (e) {
              // ignore
            }
          }

          if (!pk) {
            // fallback to ctid (Postgres physical row identifier)
            pk = 'ctid'
          }

          let whereClause = `"${f}" IS NOT NULL`
          if (minThreshold !== null) whereClause += ` AND "${f}" > ${minThreshold}`
          const sampleMapSql = `SELECT "${pk}" AS pk, "${f}" AS val FROM "${model}" WHERE ${whereClause} ORDER BY "${pk}" LIMIT 10;`
          if (debug) console.log('Running sample map SQL:', sampleMapSql)
          const sampleMapBefore = await prisma.$queryRawUnsafe(sampleMapSql)
          console.log(`Field ${model}.${f} BEFORE count=${beforeCount} sample_map=`, sampleMapBefore)
        } else {
          const sampleSql = `SELECT "${f}" AS val FROM "${model}" WHERE "${f}" IS NOT NULL LIMIT 5;`
          if (debug) console.log('Running sample SQL:', sampleSql)
          const sampleBefore = await prisma.$queryRawUnsafe(sampleSql)
          console.log(`Field ${model}.${f} BEFORE count=${beforeCount} sample=`, sampleBefore)
        }

  let updateWhere = `"${f}" IS NOT NULL`
  if (minThreshold !== null) updateWhere += ` AND "${f}" > ${minThreshold}`
  const updateSql = `UPDATE "${model}" SET "${f}" = CASE WHEN "${f}" IS NULL THEN NULL ELSE CAST( (CAST("${f}" AS NUMERIC) / ${divisor}) AS NUMERIC(12,2)) END WHERE ${updateWhere} RETURNING 1;`

        if (dry) {
          console.log('DRY RUN - would execute:', updateSql)
          continue
        }

        if (debug) console.log('Executing:', updateSql)
        const updatedRowsRes = await prisma.$queryRawUnsafe(updateSql)
        const updatedRows = Array.isArray(updatedRowsRes) ? updatedRowsRes.length : 0

        if (mapFlag) {
          // sample after map
          const pkCandidates = ['id', 'ID', 'Id']
          let pk = null
          for (const cand of pkCandidates) {
            try {
              const pkCheck = await prisma.$queryRawUnsafe(`SELECT "${cand}" FROM "${model}" LIMIT 1;`)
              if (Array.isArray(pkCheck) && pkCheck.length > 0) {
                pk = cand
                break
              }
            } catch (e) {
              // ignore
            }
          }
          if (!pk) pk = 'ctid'
          const sampleMapSql = `SELECT "${pk}" AS pk, "${f}" AS val FROM "${model}" WHERE "${f}" IS NOT NULL ORDER BY "${pk}" LIMIT 10;`
          const sampleMapAfter = await prisma.$queryRawUnsafe(sampleMapSql)
          console.log(`Field ${model}.${f} AFTER count=${beforeCount} updatedRows=${updatedRows} sample_map=`, sampleMapAfter)
        } else {
          const sampleSql = `SELECT "${f}" AS val FROM "${model}" WHERE "${f}" IS NOT NULL LIMIT 5;`
          const sampleAfter = await prisma.$queryRawUnsafe(sampleSql)
          const cntAfterRes = await prisma.$queryRawUnsafe(cntSql)
          const afterCount = Array.isArray(cntAfterRes) && cntAfterRes[0] ? Number(cntAfterRes[0].cnt) : NaN
          console.log(`Field ${model}.${f} AFTER count=${afterCount} updatedRows=${updatedRows} sample=`, sampleAfter)
        }
      } catch (err) {
        console.error(`Error processing ${model}.${f}:`, err)
      }
    }
  }

  console.log('\n✅ Debugging run finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
