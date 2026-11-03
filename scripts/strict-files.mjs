import { spawnSync } from 'node:child_process'
const prefixes = process.argv.slice(2)
const r = spawnSync(
  'npx',
  [
    'tsc',
    '-p',
    'tsconfig.json',
    '--noEmit',
    '--strict',
    '--noImplicitAny',
    '--noUnusedLocals',
    '--noUnusedParameters'
  ],
  { encoding: 'utf8' }
)
if (r.error || r.status === null) {
  process.stderr.write(`strict-files: tsc did not run: ${r.error?.message ?? r.signal}\n`)
  process.exit(1)
}
const lines = `${r.stdout}\n${r.stderr}`.split('\n')
const unattributed = lines.filter(
  (line) =>
    /^error TS\d+/.test(line) || (/: error TS\d+/.test(line) && !/^(src|tests)\//.test(line))
)
const bad = [...unattributed, ...lines.filter((line) => prefixes.some((p) => line.startsWith(p)))]
if (bad.length > 0) {
  process.stderr.write(bad.join('\n') + '\n')
  process.exit(1)
}
