import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pkg, root } from './packages.ts'

const deno = join(root, 'node_modules', '.bin', 'deno')

execFileSync(deno, ['doc', '--lint', ...Object.values(pkg.jsrExports)], {
  cwd: root,
  // Without package.json detection Deno skips the root @types/node, which source must not use.
  env: { ...process.env, DENO_NO_PACKAGE_JSON: '1' },
  stdio: 'inherit'
})
