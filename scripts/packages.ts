import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const root = join(import.meta.dirname, '..')

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function subpathExports(file: string, value: unknown): Record<string, unknown> {
  const exports = typeof value === 'string' ? { '.': value } : value
  if (typeof exports !== 'object' || exports === null || Array.isArray(exports)) {
    throw new Error(`${file}: exports must be a string or an object of subpaths`)
  }
  for (const subpath of Object.keys(exports)) {
    if (subpath !== '.' && !subpath.startsWith('./')) {
      throw new Error(`${file}: exports key ${subpath} is not a subpath`)
    }
  }
  return exports as Record<string, unknown>
}

const manifestFile = join(root, 'package.json')
const denoFile = join(root, 'deno.json')
const manifest = readJson(manifestFile)
const deno = readJson(denoFile)
const jsrExports = subpathExports(denoFile, deno.exports)
for (const [subpath, source] of Object.entries(jsrExports)) {
  if (typeof source !== 'string') {
    throw new Error(`${denoFile}: exports ${subpath} must be a path to a source file`)
  }
}
if (typeof manifest.name !== 'string' || !manifest.name) {
  throw new Error(`${manifestFile}: name must be a nonempty string`)
}
export const pkg = {
  name: manifest.name,
  exports: subpathExports(manifestFile, manifest.exports),
  jsrExports: jsrExports as Record<string, string>
}

export function specifier(subpath: string): string {
  return subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`
}
