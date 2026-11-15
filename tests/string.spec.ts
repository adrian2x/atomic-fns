import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  camelCase,
  capitalize,
  deburr,
  kebabCase,
  pascalCase,
  slugify,
  snakeCase,
  startCase,
  truncate,
  words
} from '../src/string/index.ts'
import { segmenterWords } from '../src/string/words.ts'

afterEach(() => vi.restoreAllMocks())

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

  it.each([
    [' a'.repeat(20), Array(20).fill('a')],
    ['aA'.repeat(20), ['a', ...Array(19).fill('Aa'), 'A']],
    ["a'".repeat(20), [`${"a'".repeat(19)}a`]],
    ['1t'.repeat(20), Array(20).fill(['1', 't']).flat()],
    ['👨‍👩‍👧'.repeat(20), Array(20).fill('👨‍👩‍👧')],
    ['é'.repeat(40), ['é'.repeat(40)]],
    [`${'a'.repeat(40)}!`, ['a'.repeat(40)]],
    ["A'S".repeat(20), ["A'S".repeat(20)]],
    ['1️⃣'.repeat(20), Array(20).fill('1️⃣')]
  ])('splits repeated adversarial input %s', (input, expected) => {
    expect(words(input)).toStrictEqual(expected)
  })
})

describe('case converters', () => {
  it('capitalize leaves only the first code point in upper case', () => {
    expect(capitalize('test')).toBe('Test')
    expect(capitalize('FRED')).toBe('Fred')
    expect(capitalize('𐐨ABC')).toBe('𐐀abc')
    expect(capitalize('')).toBe('')
  })

  it('camelCase joins words in camel case', () => {
    expect(camelCase('equipment class name')).toBe('equipmentClassName')
    expect(camelCase('Equipment Class Name')).toBe('equipmentClassName')
    expect(camelCase('')).toBe('')
  })

  it('pascalCase joins words in Pascal case', () => {
    expect(pascalCase('equipment class name')).toBe('EquipmentClassName')
    expect(pascalCase('Equipment Class Name')).toBe('EquipmentClassName')
  })

  it('snakeCase joins lowercased words with _', () => {
    expect(snakeCase('equipment class name')).toBe('equipment_class_name')
    expect(snakeCase('equipment-class-name')).toBe('equipment_class_name')
    expect(snakeCase('Equipment Class Name')).toBe('equipment_class_name')
    expect(snakeCase('XMLHttpRequest')).toBe('xml_http_request')
  })

  it('kebabCase joins lowercased words with -', () => {
    expect(kebabCase('equipment class name')).toBe('equipment-class-name')
    expect(kebabCase('equipment_class_name')).toBe('equipment-class-name')
    expect(kebabCase('Equipment Class Name')).toBe('equipment-class-name')
    expect(kebabCase('--foo-bar--')).toBe('foo-bar')
  })

  it('capitalize applies Unicode titlecase to the first code point', () => {
    expect(capitalize('ǆemal')).toBe('ǅemal')
    expect(capitalize('ǳ')).toBe('ǲ')
    expect(capitalize('Ǳ')).toBe('ǲ')
    expect(capitalize('ǲ')).toBe('ǲ')
    expect(capitalize('ǅemal')).toBe('ǅemal')
    expect(capitalize('ǈ')).toBe('ǈ')
    expect(capitalize('ǋ')).toBe('ǋ')
    expect(capitalize('საქართველო')).toBe('საქართველო')
    expect(capitalize('ᾳb')).toBe('ᾼb')
    expect(capitalize('ᾀ')).toBe('ᾈ')
    expect(capitalize('ᾧ')).toBe('ᾯ')
    expect(capitalize('ᾲ')).toBe('Ὰͅ')
    expect(capitalize('ŉb')).toBe('ʼNb')
    expect(capitalize('ᾈ')).toBe('ᾈ')
    expect(capitalize('ßa')).toBe('Ssa')
  })

  it('converters lowercase a final sigma in context', () => {
    expect(capitalize('ΑΣ')).toBe('Ας')
    expect(pascalCase('ΑΣ')).toBe('Ας')
    expect(camelCase('foo ΑΣ')).toBe('fooΑς')
  })

  it('converters keep a dotted capital I as one letter', () => {
    expect(capitalize('\u0130stanbul')).toBe('\u0130stanbul')
    expect(pascalCase('\u0130zmir')).toBe('\u0130zmir')
  })

  it('pascalCase and startCase uppercase an astral first code point', () => {
    expect(pascalCase('𐐨abc')).toBe('𐐀abc')
    expect(startCase('𐐨abc')).toBe('𐐀abc')
  })

  it('pascalCase uppercases a digraph where capitalize titlecases it', () => {
    expect(pascalCase('ǆemal')).toBe('Ǆemal')
    expect(startCase('ǆemal')).toBe('Ǆemal')
  })

  it('capitalize gives the same result on a Turkish host', () => {
    const toLocaleLowerCase = String.prototype.toLocaleLowerCase
    const toLocaleUpperCase = String.prototype.toLocaleUpperCase
    vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function (this: string) {
      return toLocaleLowerCase.call(this, 'tr')
    })
    vi.spyOn(String.prototype, 'toLocaleUpperCase').mockImplementation(function (this: string) {
      return toLocaleUpperCase.call(this, 'tr')
    })
    expect(capitalize('KIŞ')).toBe('Kiş')
    expect(capitalize('istanbul')).toBe('Istanbul')
    expect(capitalize('I\u0307x')).toBe('I\u0307x')
  })

  it('converters drop apostrophes', () => {
    expect(camelCase("don't stop")).toBe('dontStop')
    expect(camelCase('don\u2019t stop')).toBe('dontStop')
  })

  it('converters keep accents', () => {
    expect(pascalCase('føo bar')).toBe('FøoBar')
  })

  it('startCase capitalizes each word and keeps the rest', () => {
    expect(startCase('--foo-bar--')).toBe('Foo Bar')
    expect(startCase('fooBar')).toBe('Foo Bar')
    expect(startCase('__FOO_BAR__')).toBe('FOO BAR')
    expect(startCase("don't stop")).toBe('Dont Stop')
    expect(startCase('')).toBe('')
  })

  it('converters read null and undefined as empty and other values through String', () => {
    expect(camelCase(undefined)).toBe('')
    expect(kebabCase(true)).toBe('true')
    expect(startCase(null)).toBe('')
    expect(capitalize(undefined)).toBe('')
    expect(capitalize(123)).toBe('123')
  })
})

describe('deburr', () => {
  it('deburr folds Latin letters and keeps other scripts', () => {
    expect(deburr('Antoine de Saint-Exupéry')).toBe('Antoine de Saint-Exupery')
    expect(deburr('Œuvre ß ø Ł đ Æ þ')).toBe('OEuvre ss o L d AE th')
    expect(deburr('Crème Brûlée Ångström')).toBe('Creme Brulee Angstrom')
    expect(deburr('й')).toBe('й')
    expect(deburr('が')).toBe('が')
    expect(deburr('a\u0301')).toBe('a')
    expect(deburr('\u03AC')).toBe('\u03AC')
  })

  it('deburr applies the CLDR Latin-ASCII letter folds', () => {
    expect(deburr('ÆÐØÞßæðøþĐđĦħıĲĳĸĿŀŁłŉŊŋŒœŦŧſẞ')).toBe(
      "AEDOTHssaedothDdHhiIJijqLlLl'nNnOEoeTtsSS"
    )
    expect(deburr('1\u0301')).toBe('1')
    expect(slugify('Ærøskøbing')).toBe('aeroskobing')
    expect(slugify('STRA\u1E9EE')).toBe(slugify('Straße'))
  })

  it('deburr keeps variation selectors, so a keycap stays an emoji', () => {
    expect(deburr('1\uFE0F\u20E3')).toBe('1\uFE0F\u20E3')
    expect(deburr('Top 3\uFE0F\u20E3 cafés')).toBe('Top 3\uFE0F\u20E3 cafes')
    expect(deburr('a\uFE0F\u0301')).toBe('a\uFE0F')
    expect(words(deburr('1\uFE0F\u20E3 x'))).toEqual(['1\uFE0F\u20E3', 'x'])
  })

  it('deburr cuts a mark run to 30, so normalize stays linear', () => {
    const marks = (n: number): string => '́'.repeat(n)
    expect(deburr(`ก${marks(100)}`)).toBe(`ก${marks(30)}`)
    expect(deburr(`ก${marks(30)}x`)).toBe(`ก${marks(30)}x`)
    expect(deburr(`a${'̖́'.repeat(50)}b`)).toBe('ab')
    expect(slugify(`ก${marks(100)}`)).toBe(`ก${marks(30)}`)
  })

  it('deburr preserves normalized marks after another script', () => {
    expect(deburr(`ก${'\u0344'.repeat(30)}`.repeat(2))).toBe(
      `ก${'\u0308\u0301'.repeat(30)}`.repeat(2)
    )
    expect(deburr(`ก${'\u0301'.repeat(31)}`.repeat(2))).toBe(`ก${'\u0301'.repeat(30)}`.repeat(2))
  })

  it('deburr keeps ASCII text', () => {
    expect(deburr('plain ASCII text')).toBe('plain ASCII text')
  })
})

describe('slugify', () => {
  it('slugify lowercases and keeps Unicode letters after removing marks', () => {
    expect(slugify('equipment_class_name')).toBe('equipment-class-name')
    expect(slugify('Equipment Class Name')).toBe('equipment-class-name')
    expect(slugify('Antoine de Saint-Exupéry')).toBe('antoine-de-saint-exupery')
    expect(slugify('Ægir og Ødin')).toBe('aegir-og-odin')
    expect(slugify('がぎ')).toBe('がぎ')
    expect(slugify('Йога')).toBe('йога')
    expect(slugify('')).toBe('')
  })

  it('slugify keeps the case with lower: false', () => {
    expect(slugify('Antoine de Saint-Exupéry', { lower: false })).toBe('Antoine-de-Saint-Exupery')
    expect(slugify('Ægir og Ødin', { lower: false })).toBe('AEgir-og-Odin')
    expect(slugify('Йога', { lower: false })).toBe('Йога')
    expect(slugify('ΑΣ ΟΔΟΣ')).toBe('ας-οδος')
  })

  it('slugify keeps non-Latin marks inside words', () => {
    expect(slugify('हिन्दी')).toBe('हिन्दी')
    expect(slugify('สวัสดี ครับ')).toBe('สวัสดี-ครับ')
    expect(slugify('தமிழ்')).toBe('தமிழ்')
  })

  it('slugify drops apostrophes inside words, as kebabCase does', () => {
    expect(slugify("don't stop")).toBe('dont-stop')
    expect(slugify('l\u2019\u00e9t\u00e9')).toBe('lete')
    expect(slugify("rock 'n' roll")).toBe('rock-n-roll')
    expect(slugify("हिन्दी's")).toBe('हिन्दीs')
    expect(kebabCase("हिन्दी's")).toBe('हिन्दीs')
  })

  it('slugify drops default-ignorable code points', () => {
    expect(slugify('\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645')).toBe(
      '\u0645\u06CC\u062E\u0648\u0627\u0647\u0645'
    )
    expect(slugify('co\u00ADoperate')).toBe('cooperate')
    expect(slugify('admin\u3164')).toBe('admin')
    expect(slugify('\u3164')).toBe('')
    expect(slugify('\u0439\u034F\u043E\u0433\u0430')).toBe('\u0439\u043E\u0433\u0430')
  })

  it('slugify drops a mark that has no letter to sit on', () => {
    expect(slugify('\u0301a')).toBe('a')
    expect(slugify('foo: \u0301bar')).toBe('foo-bar')
    expect(slugify('a: \u0301: b')).toBe('a-b')
  })

  it('slugify takes a long two-byte run past the regexp backtrack stack', () => {
    expect(slugify('\u2014'.repeat(5e6))).toBe('')
    expect(slugify(`a${'\u2014'.repeat(5e6)}b`)).toBe('a-b')
  })

  it('deburr and slugify read null and undefined as empty and other values through String', () => {
    expect(deburr(null)).toBe('')
    expect(deburr(123)).toBe('123')
    expect(slugify(0)).toBe('0')
    expect(slugify(undefined)).toBe('')
  })
})

describe('truncate', () => {
  it('keeps a string that fits', () => {
    expect(truncate('hi-diddly-ho')).toBe('hi-diddly-ho')
    expect(truncate('abcd', { length: 4, omission: '\u2026' })).toBe('abcd')
  })

  it('cuts to length graphemes, omission included, as lodash does', () => {
    expect(truncate('hi-diddly-ho there, neighborino')).toBe('hi-diddly-ho there, neighbo...')
    expect(truncate('hi-diddly-ho there, neighborino', { length: 24 })).toBe(
      'hi-diddly-ho there, n...'
    )
    expect(truncate('hi-diddly-ho there, neighborino', { omission: ' [...]' })).toBe(
      'hi-diddly-ho there, neig [...]'
    )
    expect(truncate('abcdef', { length: 2 })).toBe('...')
    expect(truncate('abcdef', { length: 0, omission: '' })).toBe('')
  })

  it('never splits a grapheme', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
    expect(truncate(family.repeat(3), { length: 2, omission: '' })).toBe(family.repeat(2))
    expect(truncate('e\u0301e\u0301e\u0301', { length: 2, omission: '' })).toBe('e\u0301e\u0301')
    expect(truncate(`abc${family}`, { length: 3, omission: '\u2026' })).toBe('ab\u2026')
    expect(truncate('\u{1F1EF}\u{1F1F5}xy', { length: 2, omission: '.' })).toBe(
      '\u{1F1EF}\u{1F1F5}.'
    )
  })

  it('refuses a length that is not a non-negative integer', () => {
    for (const length of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => truncate('abc', { length })).toThrow(RangeError)
    }
  })

  it('reads null and undefined as empty', () => {
    expect(truncate(null)).toBe('')
    expect(truncate(undefined, { length: 0 })).toBe('')
  })

  it('stops reading once it has cut', () => {
    const long = 'x'.repeat(100)
    const segment = Intl.Segmenter.prototype.segment
    let reads = 0
    vi.spyOn(Intl.Segmenter.prototype, 'segment').mockImplementation(function (
      this: Intl.Segmenter,
      input
    ) {
      const segments = segment.call(this, input)
      return {
        containing: segments.containing.bind(segments),
        *[Symbol.iterator](): Generator<Intl.SegmentData, undefined> {
          for (const item of segments) {
            if (input === long) reads++
            yield item
          }
        }
      }
    })

    expect(truncate(long, { length: 4 })).toBe('x...')
    expect(reads).toBeLessThanOrEqual(5)
  })
})
