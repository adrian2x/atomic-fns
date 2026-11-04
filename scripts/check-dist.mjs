/**
 * Import every package.json exports entry from dist/ and run a small smoke call.
 * Plain Node - no deps. Fails the process on the first bad entry.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = require(resolve(root, 'package.json'))

function hasCallableExport(mod) {
  for (const v of Object.values(mod)) {
    if (typeof v === 'function') return true
  }
  return false
}

/** Smoke calls keyed by export subpath ('.' is the barrel). */
const smokes = {
  '.': async (m) => {
    const got = m.decimal('1.5').add(1).toString()
    if (got !== '2.5') throw new Error(`barrel decimal smoke: expected '2.5', got ${JSON.stringify(got)}`)
  },
  './decimal': async (m) => {
    const got = m.decimal('1.5').add(1).toString()
    if (got !== '2.5') throw new Error(`decimal smoke: expected '2.5', got ${JSON.stringify(got)}`)
  },
  './collections': async (m) => {
    const got = m.compact([0, 1, null, 2])
    if (JSON.stringify(got) !== JSON.stringify([1, 2])) {
      throw new Error(`collections smoke: unexpected ${JSON.stringify(got)}`)
    }
  },
  './i18n': async (m) => {
    const got = m.Duration.from('P1D').toString()
    if (got !== 'P1D') throw new Error(`i18n smoke: unexpected Duration ${JSON.stringify(got)}`)
  },
  './functools': async (m) => {
    const add1 = (x) => x + 1
    if (m.flow(add1, add1)(1) !== 3) throw new Error('functools smoke failed')
  },
  './globals': async (m) => {
    if (m.type(1) !== 'number') throw new Error('globals smoke failed')
  },
  './itertools': async (m) => {
    if (m.all([1, 2, 3], (x) => x > 0) !== true) throw new Error('itertools smoke failed')
  },
  './math': async (m) => {
    if (m.round(1.5) !== 2) throw new Error('math smoke failed')
  },
  './operators': async (m) => {
    if (m.add(1, 2) !== 3) throw new Error('operators smoke failed')
  },
  './random': async (m) => {
    const n = m.randomInt(1, 1)
    if (n !== 1) throw new Error(`random smoke: expected 1, got ${String(n)}`)
  },
  './string': async (m) => {
    if (m.capitalize('hello') !== 'Hello') throw new Error('string smoke failed')
  }
}

const exportsMap = pkg.exports
if (!exportsMap || typeof exportsMap !== 'object') {
  console.error('package.json missing exports map')
  process.exit(1)
}

let failed = 0
for (const [subpath, target] of Object.entries(exportsMap)) {
  const rel =
    typeof target === 'string'
      ? target
      : target && typeof target === 'object'
        ? target.default
        : undefined
  if (typeof rel !== 'string') {
    console.error(`skip ${subpath}: no default export path`)
    failed++
    continue
  }
  const abs = resolve(root, rel)
  try {
    await access(abs, fsConstants.R_OK)
  } catch {
    console.error(`FAIL ${subpath}: missing file ${rel}`)
    failed++
    continue
  }
  let mod
  try {
    mod = await import(pathToFileURL(abs).href)
  } catch (err) {
    console.error(`FAIL ${subpath}: import error: ${err instanceof Error ? err.message : String(err)}`)
    failed++
    continue
  }
  if (!hasCallableExport(mod)) {
    console.error(`FAIL ${subpath}: no function/class exports`)
    failed++
    continue
  }
  const smoke = smokes[subpath]
  if (smoke) {
    try {
      await smoke(mod)
    } catch (err) {
      console.error(`FAIL ${subpath}: smoke: ${err instanceof Error ? err.message : String(err)}`)
      failed++
      continue
    }
  }
  console.log(`ok ${subpath}`)
}

if (failed > 0) {
  console.error(`${String(failed)} export(s) failed`)
  process.exit(1)
}
console.log(`all ${String(Object.keys(exportsMap).length)} exports ok`)
