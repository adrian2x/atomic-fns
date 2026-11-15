import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pkg, root, specifier } from './packages.ts'

const typescript = process.env.CONSUMER_TYPESCRIPT

const projects = {
  'tsconfig.node.json': {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    lib: ['ESNext'],
    types: ['node'],
    typeRoots: [join(root, 'node_modules', '@types')]
  },
  'tsconfig.browser.json': {
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ESNext', 'DOM', 'DOM.Iterable'],
    types: []
  }
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function installApp(dir: string, dependencies: Record<string, string>): void {
  mkdirSync(dir)
  writeJson(join(dir, 'package.json'), {
    name: 'consumer',
    private: true,
    type: 'module',
    scripts: { install: 'node install.js' },
    dependencies
  })
  writeFileSync(
    join(dir, 'install.js'),
    "import { writeFileSync } from 'node:fs'\nwriteFileSync('install-ran', '')\n"
  )
  run(
    'npm',
    ['install', '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund'],
    dir
  )
  if (existsSync(join(dir, 'install-ran'))) throw new Error('npm install ran lifecycle scripts')
}

const work = mkdtempSync(join(tmpdir(), 'atomic-stack-consumer-'))
try {
  const tarballs = join(work, 'tarballs')
  mkdirSync(tarballs)
  const packOutput = JSON.parse(
    run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--loglevel=warn', '--pack-destination', tarballs],
      root
    )
  ) as { name: string; filename: string }[] | Record<string, { filename: string }>
  // npm 11 prints an array of packs, npm 12 an object keyed by package name.
  const packed = Array.isArray(packOutput)
    ? Object.fromEntries(packOutput.map((pack) => [pack.name, pack]))
    : packOutput

  const tarball = packed[pkg.name]
  if (!tarball) throw new Error(`npm pack produced no tarball for ${pkg.name}`)
  const app = join(work, 'app')
  installApp(app, { [pkg.name]: `file:${join(tarballs, tarball.filename)}` })
  const names = Object.keys(pkg.exports).map(specifier)
  writeFileSync(
    join(app, 'probe.js'),
    [
      `const names = ${JSON.stringify(names)}`,
      'const exports = {}',
      'for (const name of names) exports[name] = Object.keys(await import(name)).sort()',
      'console.log(JSON.stringify(exports))',
      ''
    ].join('\n')
  )
  const loaded = JSON.parse(run(process.execPath, ['probe.js'], app)) as Record<string, string[]>
  const entries = Object.entries(loaded)
  console.log(`ok ${pkg.name} alone: ${names.length} entry points load`)

  const typesApp = join(work, 'types')
  if (typescript) installApp(typesApp, { typescript })
  const bindings: string[] = []
  const lines = entries.map(([name, exports], entry) => {
    const imported = exports.map((exported) => {
      const binding = `entry${entry}_${bindings.length}`
      bindings.push(binding)
      return `${exported} as ${binding}`
    })
    return `import { ${imported.join(', ')} } from '${name}'`
  })
  writeFileSync(
    join(app, 'index.ts'),
    [...lines, `export const entries = [${bindings.join(', ')}]`, ''].join('\n')
  )
  for (const [file, options] of Object.entries(projects)) {
    writeJson(join(app, file), {
      compilerOptions: {
        target: 'ES2022',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        ...options
      },
      include: ['index.ts']
    })
  }

  const tsc = join(typescript ? typesApp : root, 'node_modules', '.bin', 'tsc')
  console.log(`TypeScript ${run(tsc, ['--version'], app).trim()}, ${entries.length} entry points`)
  for (const file of Object.keys(projects)) {
    execFileSync(tsc, ['-p', file], { cwd: app, stdio: 'inherit' })
    console.log(`ok ${file}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
