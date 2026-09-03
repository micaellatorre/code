# TECH-STOCK UX Importer for Figma

Plugin local de Figma para convertir el **TECH-STOCK UX Atomic Design Atlas** en una estructura editable y reproducible.

## Qué importa

- Foundations y color tokens base.
- Catálogo de componentes por nivel: Atom, Molecule, Organism y Template.
- 32 interfaces Desktop.
- 32 interfaces Mobile First.
- Metadata por pantalla: URL runtime, path del repo, entidad dominante, estado y user stories.
- Crops PNG/JPG opcionales como referencia visual dentro del frame.

El plugin **no convierte píxeles mágicamente en componentes perfectos**. El atlas y el manifest son la fuente estructural; los mockups son target visual. Esto permite mantener un Design System real en lugar de 64 capturas desconectadas.

## Instalación local en Figma Desktop

1. Clonar o actualizar `micaellatorre/code`.
2. Abrir Figma Desktop.
3. `Plugins > Development > Import plugin from manifest...`.
4. Seleccionar `tools/figma/tech-stock-ux-importer/manifest.json`.
5. Abrir el archivo Figma destino.
6. Ejecutar `Plugins > Development > TECH-STOCK UX Importer`.
7. Seleccionar `tech-stock-ux-manifest.json`.
8. Opcionalmente seleccionar los crops cuyo nombre coincida con `referenceAsset`.
9. Ejecutar **Importar en Figma**.

## Arquitectura generada

- `00 Foundations`
- `01 Atoms`
- `02 Molecules`
- `03 Organisms`
- `04 Templates`
- `05 Desktop Interfaces`
- `06 Mobile Interfaces`
- `07 Walkthroughs`
- `08 Reference Boards`

## Regla de sincronización

El plugin reemplaza nodos de pantalla por nombre (`D01`, `M01`, etc.) al reimportar, en lugar de crear duplicados. El manifest debe evolucionar junto con el atlas.

## Archivo Figma conectado

`TECH-STOCK UX Migration — Design System & 64 Interfaces`

https://www.figma.com/design/2xhS3kTvqOysR0As2PEZfz

## Próximo paso

La segunda versión del importer debe resolver **component instances y variants** en lugar de generar sólo estructuras editables, y luego mapearlas a componentes React reales mediante Figma Code Connect.
