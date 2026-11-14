import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Currency, Decimal } from '../../src/decimal/index.ts'

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8').split(
  /^## Decimal$/m
)[1]
const blocks = [...(readme ?? '').matchAll(/^```ts\n([\s\S]*?)^```$/gm)]
  .map((match) => match[1] ?? '')
  .map((block) =>
    block
      .replace(
        /^import\s+\{\s*(?:Currency|Decimal)(?:\s*,\s*(?:Currency|Decimal))*\s*,?\s*\}\s+from\s+['"]atomic-fns\/decimal['"];?[ \t]*$/gm,
        ''
      )
      .trim()
  )
  .filter(Boolean)

function checkExamples(block: string): void {
  const setup: string[] = []
  const examples: string[] = []
  let pending: string[] = []
  for (const line of block.split('\n')) {
    if (line.trim() === '') continue
    if (line.startsWith('const ')) {
      setup.push(line)
      continue
    }
    const comment = line.indexOf(' // ')
    const onlyComment = line.trimStart().startsWith('// ')
    if (comment === -1 && !onlyComment) {
      pending.push(line)
      continue
    }
    const code = onlyComment ? '' : line.slice(0, comment)
    const expected = onlyComment ? line.trimStart().slice(3) : line.slice(comment + 4)
    const expression = [...pending, code].join('\n').trim().replace(/^;/, '')
    pending = []
    examples.push(`expect((${expression}), ${JSON.stringify(expression)}).toEqual((${expected}))`)
  }
  expect(pending, 'an expression without an expected value').toEqual([])
  expect(examples.length).toBeGreaterThan(0)
  const body = `${setup.join('\n')}\n${examples.join('\n')}`
  new Function('Decimal', 'Currency', 'expect', body)(Decimal, Currency, expect)
}

describe('README', () => {
  it('contains a Decimal section with executable examples', () => {
    expect(readme).toBeDefined()
    expect(blocks.length).toBeGreaterThan(0)
  })

  for (const [index, block] of blocks.entries()) {
    it(`gives the stated output in code block ${String(index + 1)}`, () => {
      checkExamples(block)
    })
  }
})
