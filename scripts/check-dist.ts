import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { pkg, root, specifier } from './packages.ts'

let failed = 0
let checked = 0
const npmSubpaths = Object.keys(pkg.exports).sort()
const jsrSubpaths = Object.keys(pkg.jsrExports).sort()
if (!isDeepStrictEqual(npmSubpaths, jsrSubpaths)) {
  console.error(
    `FAIL ${pkg.name}: npm exports ${npmSubpaths} differ from JSR exports ${jsrSubpaths}`
  )
  process.exit(1)
}
for (const subpath of npmSubpaths) {
  const name = specifier(subpath)
  checked++
  try {
    const built = Object.keys(await import(name)).sort()
    const source = Object.keys(
      await import(pathToFileURL(join(root, pkg.jsrExports[subpath])).href)
    ).sort()
    if (!isDeepStrictEqual(built, source)) {
      throw new Error(`exports [${built}], source exports [${source}]`)
    }
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

if (failed > 0) {
  console.error(`${failed} of ${checked} entry points failed`)
  process.exit(1)
}
console.log(`all ${checked} entry points load from dist and match their source exports`)
