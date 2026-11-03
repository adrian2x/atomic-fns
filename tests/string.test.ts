import { describe, expect, it } from 'vitest'
import * as string from '../src/string/index.js'

describe('string', () => {
  it('SPEC-R63 capitalize first code point', () => {
    expect(string.capitalize('test')).toBe('Test')
    expect(string.capitalize('𐐨abc').startsWith('𐐀')).toBe(true)
    expect(string.capitalize('')).toBe('')
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

  it('SPEC-R63 slugify keeps Unicode letters after removing marks', () => {
    expect(string.slugify('equipment_class_name')).toBe('equipment-class-name')
    expect(string.slugify('equipment class name')).toBe('equipment-class-name')
    expect(string.slugify('Antoine de Saint-Exupéry')).toBe('Antoine-de-Saint-Exupery')
    expect(string.slugify('Ægir og Ødin')).toBe('Ægir-og-Ødin')
    expect(string.slugify('')).toBe('')
  })
})
