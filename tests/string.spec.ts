import { describe, expect, it } from 'vitest'
import { words } from '../src/string/index.ts'
import { segmenterWords } from '../src/string/words.ts'

/** The fastest of three runs, in milliseconds. */
function fastest(fn: () => void): number {
  let best = Number.POSITIVE_INFINITY
  for (let run = 0; run < 3; run++) {
    const start = performance.now()
    fn()
    best = Math.min(best, performance.now() - start)
  }
  return best
}

describe('words', () => {
  it('splits on case changes, separators and digits', () => {
    expect(words('equipmentClassName')).toEqual(['equipment', 'Class', 'Name'])
    expect(words('equipment class name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment_class_name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment-class-name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment,class,name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment/class/name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment.class.name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment+class+name')).toEqual(['equipment', 'class', 'name'])
    expect(words('equipment0class0name')).toEqual(['equipment', '0', 'class', '0', 'name'])
    expect(words('equipment0class0name', /[^0]+/)).toEqual(['equipment', 'class', 'name'])
    expect(words('')).toEqual([])
    expect(words('   ')).toEqual([])
  })

  it('emoji variation selectors and keycaps stay whole', () => {
    expect(words('abc‼️def')).toEqual(['abc', '‼️', 'def'])
    expect(words('1️⃣ x')).toEqual(['1️⃣', 'x'])
    expect(words('a👨‍👩‍👧b 🇺🇸 x')).toEqual(['a', '👨‍👩‍👧', 'b', '🇺🇸', 'x'])
    expect(words('#️⃣ x')).toEqual(['#️⃣', 'x'])
    expect(words('a © b ™ c')).toEqual(['a', 'b', 'c'])
  })

  it('splits adjacent keycaps into one word each', () => {
    expect(words('Room 1️⃣2️⃣')).toEqual(['Room', '1️⃣', '2️⃣'])
    expect(words('1️⃣2️⃣3️⃣')).toEqual(['1️⃣', '2️⃣', '3️⃣'])
    expect(words('11️⃣')).toEqual(['1', '1️⃣'])
    expect(words('2️⃣nd place')).toEqual(['2️⃣', 'nd', 'place'])
    expect(words('#️⃣#️⃣')).toEqual(['#️⃣', '#️⃣'])
  })

  it('splits words at bidi controls', () => {
    expect(words('user\u202Eadmin')).toEqual(['user', 'admin'])
    expect(words('a\u2066b\u2069c')).toEqual(['a', 'b', 'c'])
    expect(words('a\u200Fb')).toEqual(['a', 'b'])
  })

  it('splits at Unicode case boundaries', () => {
    expect(words('grandŒil')).toEqual(['grand', 'Œil'])
    expect(words('fooŁódź')).toEqual(['foo', 'Łódź'])
    expect(words('ПриветМир')).toEqual(['Привет', 'Мир'])
    expect(words('ΑλφαΒήτα')).toEqual(['Αλφα', 'Βήτα'])
    expect(words('fooBéta')).toEqual(['foo', 'Béta'])
    expect(words('café bar')).toEqual(['café', 'bar'])
    expect(words('שלוםWorld')).toEqual(['שלום', 'World'])
    expect(words('مرحباWorld')).toEqual(['مرحبا', 'World'])
    expect(words('HTMLParser\u00E9')).toEqual(['HTML', 'Parser\u00E9'])
  })

  it('ordinals stay one word', () => {
    expect(words('11th 12th 13th 21st 1st')).toEqual(['11th', '12th', '13th', '21st', '1st'])
    expect(words('1stPlace')).toEqual(['1st', 'Place'])
    expect(words('5thx')).toEqual(['5', 'thx'])
    expect(words('1STX')).toEqual(['1', 'STX'])
    expect(words('1stX')).toEqual(['1st', 'X'])
    expect(words('2ab')).toEqual(['2', 'ab'])
    expect(words('١st')).toEqual(['١st'])
    expect(words('١stPlace')).toEqual(['١st', 'Place'])
    expect(words('١thX')).toEqual(['١th', 'X'])
    expect(words('١THx')).toEqual(['١', 'T', 'Hx'])
    expect(words('٢a')).toEqual(['٢', 'a'])
    expect(words('٢st\u0301')).toEqual(['٢st\u0301'])
    expect(words('11th\u00E9')).toEqual(['11', 'th\u00E9'])
    expect(words('5thx\u00E9')).toEqual(['5', 'thx\u00E9'])
  })

  it('plural acronyms stay one word', () => {
    expect(words('IDs APIs XMLs URLs')).toEqual(['IDs', 'APIs', 'XMLs', 'URLs'])
    expect(words('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request'])
    expect(words('APIsFoo')).toEqual(['APIs', 'Foo'])
    expect(words('APIsfoo')).toEqual(['AP', 'Isfoo'])
    expect(words('føoAPIs')).toEqual(['føo', 'APIs'])
    expect(words('føoAPIs2')).toEqual(['føo', 'APIs', '2'])
    expect(words('føoAPIsFoo')).toEqual(['føo', 'APIs', 'Foo'])
    expect(words('APIs\u0391')).toEqual(['APIs', '\u0391'])
    expect(words('XML\u00CDs')).toEqual(['XML\u00CDs'])
  })

  it('keeps a mid-word apostrophe and drops one at a word edge', () => {
    expect(words("don't stop")).toEqual(["don't", 'stop'])
    expect(words("O'Shea")).toEqual(['O', 'Shea'])
    expect(words('don\u2019t')).toEqual(['don\u2019t'])
    expect(words('a\u2019b')).toEqual(['a\u2019b'])
    expect(words('é\u20192')).toEqual(['é', '2'])
  })

  it('keeps marks, joiners and words of other scripts whole', () => {
    expect(words('fooBar2Baz')).toEqual(['foo', 'Bar', '2', 'Baz'])
    expect(words('foo2bar\u00E9')).toEqual(['foo', '2', 'bar\u00E9'])
    expect(words('foo\u00B7bar')).toEqual(['foo', 'bar'])
    expect(words('équipement.classe')).toEqual(['équipement', 'classe'])
    expect(words('ǅungla ǈubav')).toEqual(['ǅungla', 'ǈubav'])
    expect(words('٣٤ x')).toEqual(['٣٤', 'x'])
    expect(words('co\u00ADoperate')).toEqual(['co\u00ADoperate'])
    expect(words('می\u200Cخواهم')).toStrictEqual(['می\u200Cخواهم'])
    expect(words('東久留米市').join('')).toBe('東久留米市')
  })

  it('ASCII fast path matches segmenter path', () => {
    const alphabet = "aZsStThH0 _-.'!"
    let seed = 0xc0ffee
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed
    }
    for (let n = 0; n < 500; n++) {
      const len = (rand() % 48) + 1
      let s = ''
      for (let i = 0; i < len; i++) {
        s += alphabet[rand() % alphabet.length]
      }
      expect(words(s)).toEqual(segmenterWords(s))
    }
  })

  it('words treats a null pattern as no pattern', () => {
    expect(words('a null b', null)).toEqual(['a', 'null', 'b'])
  })

  it('words takes a modifier run past the regexp backtrack stack', { timeout: 60_000 }, () => {
    const modifiers = '\u{1F3FB}'.repeat(9e6)
    const result = words(modifiers)
    expect(result.length).toBe(1)
    expect(result[0] === modifiers).toBe(true)
  })

  it('words drops an apostrophe stranded by a camel boundary', () => {
    expect(words("O'Neil")).toEqual(['O', 'Neil'])
    expect(words("D'Artagnan")).toEqual(['D', 'Artagnan'])
    expect(words("don'T")).toEqual(['don', 'T'])
    expect(words('O’Neil')).toEqual(['O', 'Neil'])
    expect(words("O'Neilé")).toEqual(['O', 'Neilé'])
    expect(words("don't")).toEqual(["don't"])
  })

  it('words keeps letters and numbers the segmenter calls non-word-like', () => {
    expect(words('CO₂')).toEqual(['CO', '₂'])
    expect(words('H₂O')).toEqual(['H', '₂', 'O'])
    expect(words('①②')).toEqual(['①', '②'])
    expect(words('½ cup')).toEqual(['½', 'cup'])
    expect(words('a 々')).toEqual(['a', '々'])
  })

  it('words splits a word from an emoji glued on by ZWJ', () => {
    expect(words('hello‍😀 world')).toEqual(['hello', '😀', 'world'])
    expect(words('42‍😀')).toEqual(['42', '😀'])
    expect(words('foo‍🎉bar baz')).toEqual(['foo', '🎉', 'bar', 'baz'])
  })

  it('keeps every whole match of a pattern, global or not', () => {
    expect(words('fred, barney, & pebbles', /[^, ]+/g)).toEqual(['fred', 'barney', '&', 'pebbles'])
    expect(words('a1b22', /\d+/)).toEqual(['1', '22'])
    expect(words('ab', /(a)(b)/)).toEqual(['ab'])
    expect(words('abc', /x/)).toEqual([])
  })

  it('throws a TypeError for a pattern that is not a RegExp', () => {
    const untypedWords = words as (s: unknown, pattern?: unknown) => string[]
    expect(() => ['fooBar'].map(untypedWords)).toThrow(
      new TypeError('words expects pattern to be a RegExp')
    )
    expect(() => untypedWords('a,b', ',')).toThrow(TypeError)
  })

  it('reads null and undefined as empty and other values through String', () => {
    expect(words(null)).toEqual([])
    expect(words(undefined)).toEqual([])
    expect(words(123)).toEqual(['123'])
  })

  it('stays linear on adversarial input', () => {
    const builders: ((n: number) => string)[] = [
      (n) => ' a'.repeat(n),
      (n) => 'aA'.repeat(n),
      (n) => "a'".repeat(n),
      (n) => '1t'.repeat(n),
      (n) => '👨‍👩‍👧'.repeat(n / 5),
      (n) => 'é'.repeat(2 * n),
      (n) => `${'a'.repeat(2 * n)}!`,
      (n) => "A'S".repeat(n),
      (n) => '1️⃣'.repeat(n)
    ]
    for (const build of builders) {
      const small = build(12_500)
      const large = build(50_000)
      const smallMs = fastest(() => {
        words(small)
      })
      const largeMs = fastest(() => {
        words(large)
      })
      expect(largeMs, large.slice(0, 6)).toBeLessThan(8 * smallMs + 5)
    }
  })
})
