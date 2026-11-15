import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const { TAG = '', RELEASE_PRERELEASE, GITHUB_OUTPUT = '', VERSION = '' } = process.env

switch (process.argv[2]) {
  case 'tag': {
    const match = /^v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?)$/.exec(TAG)
    if (!match) throw new Error(`release tag '${TAG}' is not v<version>`)
    const version = match[1]
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
    if (manifest.version !== version) {
      throw new Error(
        `tag version ${version} does not match package.json version ${manifest.version}`
      )
    }
    if (manifest.name !== 'atomic-fns') {
      throw new Error(`package.json is named ${manifest.name}, expected atomic-fns`)
    }
    const prerelease = version.includes('-')
    if (RELEASE_PRERELEASE !== String(prerelease)) {
      throw new Error(
        `version ${version} has prerelease=${prerelease}, but the GitHub release has prerelease=${RELEASE_PRERELEASE}`
      )
    }
    appendFileSync(GITHUB_OUTPUT, `version=${version}\n`)
    break
  }
  case 'publish': {
    const tarball = join(process.env.RUNNER_TEMP ?? '', 'package', process.env.TARBALL ?? '')
    const bytes = readFileSync(tarball)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== process.env.EXPECTED_SHA256) throw new Error('tarball checksum mismatch')
    const manifest = JSON.parse(
      execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' })
    )
    if (manifest.name !== 'atomic-fns' || manifest.version !== VERSION) {
      throw new Error(
        `tarball holds ${manifest.name}@${manifest.version}, expected atomic-fns@${VERSION}`
      )
    }
    // Leaving the stable tag implicit lets npm refuse versions lower than latest.
    const tagArgs = VERSION.includes('-') ? ['--tag', 'next'] : []
    const published = spawnSync(
      'npm',
      ['publish', '--ignore-scripts', '--access', 'public', ...tagArgs, tarball],
      { stdio: 'inherit' }
    )
    if (published.error) throw published.error
    if (published.status !== 0) {
      const integrity = execFileSync(
        'npm',
        [
          'view',
          `atomic-fns@${VERSION}`,
          'dist.integrity',
          '--registry=https://registry.npmjs.org',
          '--prefer-online'
        ],
        { encoding: 'utf8' }
      ).trim()
      if (integrity !== `sha512-${createHash('sha512').update(bytes).digest('base64')}`) {
        throw new Error('published version integrity does not match the packed tarball')
      }
      console.log(`atomic-fns@${VERSION} is already published with matching integrity`)
    }
    break
  }
  default:
    throw new Error('expected tag or publish')
}
