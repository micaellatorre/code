const path = require("path")

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "node",
})

require("dotenv/config")
require("ts-node/register/transpile-only")

const Module = require("module")
const originalResolveFilename = Module._resolveFilename
const srcRoot = path.resolve(__dirname, "../src")

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const scriptPath = process.argv[2]
if (!scriptPath) {
  console.error("Uso: node scripts/run-ts-script.cjs <script.ts> [...args]")
  process.exit(1)
}

process.argv = [process.argv[0], path.resolve(scriptPath), ...process.argv.slice(3)]
require(path.resolve(scriptPath))
