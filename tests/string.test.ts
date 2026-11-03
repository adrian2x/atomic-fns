import { describe, expect, it } from 'vitest'
import * as string from '../src/string/index.js'
import { segmenterWords } from '../src/string/words.js'

describe('string', () => {
  it('SPEC-R63 capitalize first code point', () => {
    expect(string.capitalize('test')).toBe('Test')
    expect(string.capitalize('𐐨abc').startsWith('𐐀')).toBe(true)
    expect(string.capitalize('')).toBe('')
    expect(string.capitalize('ǆemal')).toBe('ǅemal')
  })

  it('isAlnum', () => {
    expect(string.isAlnum('Alphas1234')).toBe(true)
    expect(string.isAlnum('not really!')).toBe(false)
  })

  it('isAlpha', () => {
    expect(string.isAlpha('Alphasonly')).toBe(true)
    expect(string.isAlpha('1234')).toBe(false)
    expect(string.isAlpha('not really!')).toBe(false)
  })

  it('isNumeric', () => {
    expect(string.isNumeric('1234')).toBe(true)
    expect(string.isNumeric('1234.0')).toBe(false)
    expect(string.isNumeric('not really!')).toBe(false)
    // Unicode Numeric_Type (not a Number() parse guard)
    expect(string.isNumeric('²')).toBe(true)
    expect(string.isNumeric('½')).toBe(true)
    expect(string.isNumeric('１２３')).toBe(true)
    expect(string.isNumeric('١٢٣')).toBe(true)
  })

  it('asciify', () => {
    expect(string.asciify('1234')).toBe('1234')
    expect(string.asciify('Bjørn 10.2.3')).toBe('Bjrn 10.2.3')
    expect(string.asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ')).toBe('PHP-MySQL')
    expect(
      string.asciify(
        '[INFO] :谷���新道, ひば���ヶ丘２丁���, ひばりヶ���, 東久留米市 (Higashikurume)'
      )
    ).toBe('[INFO] :, , ,  (Higashikurume)')
  })

  it('removeAccents', () => {
    expect(string.removeAccents('Antoine de Saint-Exupéry')).toBe('Antoine de Saint-Exupery')
    expect(string.removeAccents('Œuvre ß ø Ł đ Æ þ')).toBe('OEuvre ss o L d AE th')
    expect(string.removeAccents('Crème Brûlée Ångström')).toBe('Creme Brulee Angstrom')
    expect(string.removeAccents('й')).toBe('й')
    expect(string.removeAccents('が')).toBe('が')
    expect(string.removeAccents('が').length).toBe(1)
    expect(string.removeAccents('a\u0301')).toBe('a')
    expect(string.removeAccents('\u03AC')).toBe('\u03AC')
  })

  it('removeAccents CLDR Latin-ASCII letter folds', () => {
    const folds: [string, string][] = [
      ['\u00C6', 'AE'],
      ['\u00D0', 'D'],
      ['\u00D8', 'O'],
      ['\u00DE', 'TH'],
      ['\u00DF', 'ss'],
      ['\u00E6', 'ae'],
      ['\u00F0', 'd'],
      ['\u00F8', 'o'],
      ['\u00FE', 'th'],
      ['\u0110', 'D'],
      ['\u0111', 'd'],
      ['\u0126', 'H'],
      ['\u0127', 'h'],
      ['\u0131', 'i'],
      ['\u0132', 'IJ'],
      ['\u0133', 'ij'],
      ['\u0138', 'q'],
      ['\u013F', 'L'],
      ['\u0140', 'l'],
      ['\u0141', 'L'],
      ['\u0142', 'l'],
      ['\u0149', "'n"],
      ['\u014A', 'N'],
      ['\u014B', 'n'],
      ['\u0152', 'OE'],
      ['\u0153', 'oe'],
      ['\u0166', 'T'],
      ['\u0167', 't'],
      ['\u017F', 's']
    ]
    for (const [src, dest] of folds) {
      expect(string.removeAccents(src)).toBe(dest)
    }
    expect(string.removeAccents('Æsir')).toBe('AEsir')
    expect(string.removeAccents('Œuvre')).toBe('OEuvre')
    expect(string.removeAccents('Þór')).toBe('THor')
    expect(string.removeAccents('1\u0301')).toBe('1')
    expect(string.removeAccents('e\u0301')).toBe('e')
    expect(string.slugify('Ærøskøbing')).toBe('AEroskobing')
  })

  it('words', () => {
    expect(string.words('equipmentClassName')).toEqual(['equipment', 'Class', 'Name'])
    expect(string.words('equipment class name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment_class_name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment-class-name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment,class,name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment/class/name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment.class.name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment+class+name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('equipment0class0name')).toEqual(['equipment', '0', 'class', '0', 'name'])
    expect(string.words('equipment0class0name', '0')).toEqual(['equipment', 'class', 'name'])
  })

  it('SPEC-R63 titleCase keeps punctuation and spacing', () => {
    expect(string.titleCase('what a sentence')).toBe('What A Sentence')
    expect(string.titleCase('hello, world')).toBe('Hello, World')
    expect(string.titleCase('')).toBe('')
    expect(string.titleCase('NASA rocket fooBAR')).toBe('NASA Rocket FooBAR')
  })

  it('SPEC-R63 sentenceCase first code point', () => {
    expect(string.sentenceCase('test')).toBe('Test')
    expect(string.sentenceCase('TEST')).toBe('TEST')
  })

  it('camelCase', () => {
    expect(string.camelCase('equipment class name')).toBe('equipmentClassName')
    expect(string.camelCase('Equipment Class Name')).toBe('equipmentClassName')
  })

  it('pascalCase', () => {
    expect(string.pascalCase('equipment class name')).toBe('EquipmentClassName')
    expect(string.pascalCase('Equipment Class Name')).toBe('EquipmentClassName')
  })

  it('snakeCase', () => {
    expect(string.snakeCase('equipment class name')).toBe('equipment_class_name')
    expect(string.snakeCase('equipment-class-name')).toBe('equipment_class_name')
    expect(string.snakeCase('Equipment Class Name')).toBe('equipment_class_name')
  })

  it('kebabCase', () => {
    expect(string.kebabCase('equipment class name')).toBe('equipment-class-name')
    expect(string.kebabCase('equipment_class_name')).toBe('equipment-class-name')
    expect(string.kebabCase('Equipment Class Name')).toBe('equipment-class-name')
  })

  it('SPEC-R63 D1 emoji variation selectors and keycaps stay whole', () => {
    expect(string.words('abc‼️def')).toEqual(['abc', '‼️', 'def'])
    expect(string.words('1️⃣ x')).toEqual(['1️⃣', 'x'])
    const family = string.words('a👨‍👩‍👧b 🇺🇸 x')
    for (const w of family) {
      expect(w.startsWith('\uFE0F') || w.startsWith('\u20E3') || w.startsWith('\u200D')).toBe(false)
    }
    expect(string.words('a👨‍👩‍👧b')).toContain('👨‍👩‍👧')
    expect(string.words('#️⃣ x')).toEqual(['#️⃣', 'x'])
    expect(string.words('a © b ™ c')).toEqual(['a', 'b', 'c'])
  })

  it('SPEC-R63 D2 Unicode case boundaries', () => {
    expect(string.words('grandŒil')).toEqual(['grand', 'Œil'])
    expect(string.words('fooŁódź')).toEqual(['foo', 'Łódź'])
    expect(string.words('ПриветМир')).toEqual(['Привет', 'Мир'])
    expect(string.words('ΑλφαΒήτα')).toEqual(['Αλφα', 'Βήτα'])
    expect(string.snakeCase('ПриветМир')).toBe('привет_мир')
    expect(string.words('fooBéta')).toEqual(['foo', 'Béta'])
    expect(string.words('café bar')).toEqual(['café', 'bar'])
  })

  it('SPEC-R63 D3 ordinals stay one word', () => {
    expect(string.words('11th 12th 13th 21st 1st')).toEqual(['11th', '12th', '13th', '21st', '1st'])
    expect(string.kebabCase('11th place')).toBe('11th-place')
    expect(string.kebabCase('12th place')).toBe('12th-place')
    expect(string.kebabCase('4th place')).toBe('4th-place')
    expect(string.words('1stPlace')).toEqual(['1st', 'Place'])
    expect(string.words('5thx')).toEqual(['5', 'thx'])
  })

  it('SPEC-R63 D4 plural acronyms stay one word', () => {
    expect(string.words('IDs APIs XMLs URLs')).toEqual(['IDs', 'APIs', 'XMLs', 'URLs'])
    expect(string.camelCase('IDs')).toBe('ids')
    expect(string.camelCase('APIs')).toBe('apis')
    expect(string.camelCase('Product XMLs')).toBe('productXmls')
    expect(string.camelCase('OrderID')).toBe('orderId')
    expect(string.words('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request'])
    expect(string.words('APIsFoo')).toEqual(['APIs', 'Foo'])
  })

  it('SPEC-R63 mixed words edges and pascalCase digraph uppercase', () => {
    expect(string.words('fooBar2Baz')).toEqual(['foo', 'Bar', '2', 'Baz'])
    expect(string.words("don't stop")).toEqual(["don't", 'stop'])
    expect(string.words('equipment.class.name')).toEqual(['equipment', 'class', 'name'])
    expect(string.words('équipement.classe')).toEqual(['équipement', 'classe'])
    expect(string.words('ǅungla ǈubav')).toEqual(['ǅungla', 'ǈubav'])
    expect(string.words('٣٤ x')).toEqual(['٣٤', 'x'])
    expect(string.words('')).toEqual([])
    expect(string.words('   ')).toEqual([])
    expect(string.words('co\u00ADoperate')).toEqual(['co\u00ADoperate'])
    expect(string.words('می\u200Cخواهم')).toHaveLength(1)
    expect(string.pascalCase('ǆemal')).toBe('Ǆemal')
    expect(string.words('東久留米市').join('')).toBe('東久留米市')
    expect(() => string.words(1 as never)).toThrow(new TypeError('words expects a string'))
  })

  it('SPEC-R63 ASCII fast path matches segmenter path', () => {
    const alphabet = "aZ0 _-.'!"
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
      expect(string.words(s)).toEqual(segmenterWords(s))
    }
  })

  it('SPEC-R63 slugify keeps Unicode letters after removing marks', () => {
    expect(string.slugify('equipment_class_name')).toBe('equipment-class-name')
    expect(string.slugify('equipment class name')).toBe('equipment-class-name')
    expect(string.slugify('Antoine de Saint-Exupéry')).toBe('Antoine-de-Saint-Exupery')
    expect(string.slugify('Ægir og Ødin')).toBe('AEgir-og-Odin')
    expect(string.slugify('がぎ')).toBe('がぎ')
    expect(string.slugify('Йога')).toBe('Йога')
    expect(string.slugify('')).toBe('')
  })

  it('words covers ASCII and Unicode splitter edges', () => {
    expect(string.words('APIsfoo')).toEqual(['AP', 'Isfoo'])
    expect(string.words('1STX')).toEqual(['1', 'STX'])
    expect(string.words('1stX')).toEqual(['1st', 'X'])
    expect(string.words('2ab')).toEqual(['2', 'ab'])
    expect(string.words("O'Shea")).toEqual(["O'", 'Shea'])
    expect(string.words('don\u2019t')).toEqual(['don\u2019t'])
    expect(string.words('a\u2019b')).toEqual(['a\u2019b'])
    expect(string.words('foo\u00B7bar')).toEqual(['foo', 'bar'])
    expect(string.words('føoAPIs')).toEqual(['føo', 'APIs'])
    expect(string.words('føoAPIsFoo')).toEqual(['føo', 'APIs', 'Foo'])
    expect(string.words('APIs\u0391')).toEqual(['APIs', '\u0391'])
    expect(string.words('XML\u00CDs')).toEqual(['XML\u00CDs'])
    expect(string.words('HTMLParser\u00E9')).toEqual(['HTML', 'Parser\u00E9'])
    expect(string.words('١st')).toEqual(['١st'])
    expect(string.words('١stPlace')).toEqual(['١st', 'Place'])
    expect(string.words('١thX')).toEqual(['١th', 'X'])
    expect(string.words('١THx')).toEqual(['١', 'T', 'Hx'])
    expect(string.words('٢a')).toEqual(['٢', 'a'])
    expect(string.words('٢st\u0301')).toEqual(['٢st\u0301'])
    expect(string.words('11th\u00E9')).toEqual(['11', 'th\u00E9'])
    expect(string.words('5thx\u00E9')).toEqual(['5', 'thx\u00E9'])
    expect(string.words('foo2bar\u00E9')).toEqual(['foo', '2', 'bar\u00E9'])
    expect(string.words('cafe\u0301 bar')).toEqual(['cafe\u0301', 'bar'])
    expect(string.words('é\u20192')).toEqual(['é', '2'])
    expect(string.words('می\u200Cخواهم')).toHaveLength(1)
    expect(string.camelCase('don\u2019t stop')).toBe('dontStop')
    expect(string.pascalCase('føo bar')).toBe('FøoBar')
    expect(() => segmenterWords(1 as never)).toThrow(new TypeError('words expects a string'))
  })
})
