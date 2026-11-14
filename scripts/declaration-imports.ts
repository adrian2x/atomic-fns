// tsc keeps `.ts` in the import paths of declaration files, and TypeScript before 5.0 cannot resolve them
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const relativeTs = /((?:from|import)\s*\(?\s*['"]\.{1,2}\/[^'"]+?)(?<!\.d)\.ts(['"])/g
const left = /['"]\.{1,2}\/[^'"]*(?<!\.d)\.ts['"]/

for (const file of readdirSync('dist', { recursive: true, encoding: 'utf8' })) {
  if (!file.endsWith('.d.ts')) continue
  const path = join('dist', file)
  const text = readFileSync(path, 'utf8')
  const fixed = text.replace(relativeTs, '$1.js$2')
  if (fixed !== text) writeFileSync(path, fixed)
  if (left.test(fixed)) {
    console.error(`${path} still imports a .ts path`)
    process.exit(1)
  }
}
