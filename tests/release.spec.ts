import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const directories: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.doUnmock('node:fs')
  vi.doUnmock('node:child_process')
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function fixture(version = '3.2.1', name = 'atomic-fns') {
  const directory = mkdtempSync(join(tmpdir(), 'atomic-release-'))
  directories.push(directory)
  mkdirSync(join(directory, 'package'))
  const manifest = JSON.stringify({ name, version })
  writeFileSync(join(directory, 'package.json'), manifest)
  writeFileSync(join(directory, 'package/package.json'), manifest)
  const tarball = join(directory, 'package/release.tgz')
  execFileSync('tar', ['-czf', tarball, '-C', directory, 'package/package.json'])
  const bytes = readFileSync(tarball)
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  const registry: {
    integrity?: string
    tag?: string
    explicitTag?: boolean
    ignoreScripts?: boolean
    access?: string
    lookupError?: boolean
    rejectPublish?: boolean
    loseResponse?: boolean
  } = {}
  const env = {
    ...process.env,
    TAG: `v${version}`,
    RELEASE_PRERELEASE: String(version.includes('-')),
    GITHUB_OUTPUT: join(directory, 'output'),
    RUNNER_TEMP: directory,
    TARBALL: 'release.tgz',
    VERSION: version,
    EXPECTED_SHA256: createHash('sha256').update(bytes).digest('hex')
  }
  return {
    env,
    integrity,
    registry,
    run: async (command: string) => {
      vi.resetModules()
      vi.stubGlobal('process', { ...process, env, argv: [process.execPath, 'release.ts', command] })
      vi.doMock('node:fs', async (importOriginal) => ({
        ...(await importOriginal<typeof import('node:fs')>()),
        readFileSync: (path: string, encoding?: BufferEncoding) =>
          readFileSync(path === 'package.json' ? join(directory, path) : path, { encoding })
      }))
      vi.doMock('node:child_process', () => ({
        execFileSync: (file: string, args: string[], options: { encoding: 'utf8' }) => {
          if (file !== 'npm') return execFileSync(file, args, options)
          if (
            args[0] !== 'view' ||
            args[1] !== `atomic-fns@${env.VERSION}` ||
            args[2] !== 'dist.integrity' ||
            !registry.integrity ||
            registry.lookupError
          ) {
            throw new Error('registry lookup failed')
          }
          return `${registry.integrity}\n`
        },
        spawnSync: (file: string, args: string[]) => {
          if (
            file !== 'npm' ||
            args[0] !== 'publish' ||
            registry.integrity ||
            registry.rejectPublish
          ) {
            return { status: 1 }
          }
          registry.integrity =
            'sha512-' +
            createHash('sha512')
              .update(readFileSync(args[args.length - 1]))
              .digest('base64')
          registry.tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'latest'
          registry.explicitTag = args.includes('--tag')
          registry.ignoreScripts = args.includes('--ignore-scripts')
          registry.access = args[args.indexOf('--access') + 1]
          return { status: registry.loseResponse ? 1 : 0 }
        }
      }))
      const output: string[] = []
      vi.spyOn(console, 'log').mockImplementation((text) => output.push(String(text)))
      try {
        await import('../scripts/release.ts')
        return { status: 0, stdout: output.join('\n'), stderr: '' }
      } catch (error) {
        return { status: 1, stdout: output.join('\n'), stderr: String(error) }
      }
    },
    state: () => ({ ...registry })
  }
}

describe('release tag', () => {
  it.each([
    ['v3.2.1', 0],
    ['v3.2.2', 1]
  ])('runs tag with real exit statuses: %s', (tag, status) => {
    const directory = mkdtempSync(join(tmpdir(), 'atomic-release-cli-'))
    directories.push(directory)
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name: 'atomic-fns', version: '3.2.1', type: 'module' })
    )
    const script = join(directory, 'release.ts')
    writeFileSync(script, readFileSync(new URL('../scripts/release.ts', import.meta.url)))
    const output = join(directory, 'output')

    const result = spawnSync(process.execPath, [script, 'tag'], {
      cwd: directory,
      env: { ...process.env, TAG: tag, RELEASE_PRERELEASE: 'false', GITHUB_OUTPUT: output },
      encoding: 'utf8'
    })

    expect(result.status, result.stderr).toBe(status)
    expect(result.stdout).toBe('')
    if (status === 0) {
      expect(result.stderr).toBe('')
      expect(readFileSync(output, 'utf8')).toBe('version=3.2.1\n')
    } else {
      expect(result.stderr).toContain('tag version 3.2.2 does not match package.json version 3.2.1')
    }
  })

  it.each(['3.2.1', '3.2.1-rc.4'])('accepts the matching release %s', async (version) => {
    const release = fixture(version)

    const result = await release.run('tag')

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(release.env.GITHUB_OUTPUT, 'utf8')).toBe(`version=${version}\n`)
  })

  it.each([
    ['3.2.1', 'atomic-fns', 'not v<version>'],
    ['v3.2.2', 'atomic-fns', 'does not match package.json version'],
    ['v3.2.1', 'another-package', 'expected atomic-fns']
  ])('rejects tag %s for %s', async (tag, name, error) => {
    const release = fixture('3.2.1', name)
    release.env.TAG = tag

    const result = await release.run('tag')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(error)
  })

  it.each(['3.2.1', '3.2.1-rc.4'])(
    'rejects conflicting GitHub prerelease status for %s',
    async (version) => {
      const release = fixture(version)
      release.env.RELEASE_PRERELEASE = String(!version.includes('-'))

      const result = await release.run('tag')

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('but the GitHub release has prerelease=')
    }
  )
})

describe('release publishing', () => {
  it.each([
    ['3.2.1', 'latest', false],
    ['3.2.1-rc.4', 'next', true]
  ])('publishes %s to %s', async (version, tag, explicitTag) => {
    const release = fixture(version)

    const result = await release.run('publish')

    expect(result.status, result.stderr).toBe(0)
    expect(release.state()).toEqual({
      integrity: release.integrity,
      tag,
      explicitTag,
      ignoreScripts: true,
      access: 'public'
    })
  })

  it('refuses a changed tarball', async () => {
    const release = fixture()
    release.env.EXPECTED_SHA256 = '0'.repeat(64)

    const result = await release.run('publish')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('tarball checksum mismatch')
    expect(release.state()).toEqual({})
  })

  it.each([
    ['3.2.1', 'another-package'],
    ['3.2.2', 'atomic-fns']
  ])('refuses the wrong tarball identity %s %s', async (version, name) => {
    const release = fixture(version, name)
    release.env.VERSION = '3.2.1'

    const result = await release.run('publish')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('expected atomic-fns@3.2.1')
    expect(release.state()).toEqual({})
  })

  it('accepts an already published version only when its integrity matches', async () => {
    const release = fixture()
    Object.assign(release.registry, { integrity: release.integrity })

    const result = await release.run('publish')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('already published with matching integrity')
    expect(release.state()).toEqual({ integrity: release.integrity })
  })

  it('recovers when npm accepts the tarball but loses the response', async () => {
    const release = fixture()
    Object.assign(release.registry, { loseResponse: true })

    const result = await release.run('publish')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('already published with matching integrity')
    expect(release.state().integrity).toBe(release.integrity)
  })

  it.each([{ integrity: 'sha512-different' }, { rejectPublish: true }, { lookupError: true }])(
    'fails closed when the registry cannot confirm the tarball: %j',
    async (state) => {
      const release = fixture()
      const registryState = {
        ...state,
        ...('lookupError' in state ? { integrity: release.integrity } : {}),
        rejectPublish: true
      }
      Object.assign(release.registry, registryState)

      const result = await release.run('publish')

      expect(result.status).not.toBe(0)
      expect(result.stdout).not.toContain('already published with matching integrity')
      expect(release.state()).toStrictEqual(registryState)
    }
  )
})
