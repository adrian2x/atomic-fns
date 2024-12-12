import assert from 'assert'
import * as string from '../src/string/index.js'

describe('string', () => {
  it('capitalize', () => {
    assert(string.capitalize('test') === 'Test')
  })

  it('isAlnum', () => {
    assert(string.isAlnum('Alphas1234') === true)
    assert(string.isAlnum('not really!') === false)
  })

  it('isAlpha', () => {
    assert(string.isAlpha('Alphasonly') === true)
    assert(string.isAlpha('1234') === false)
    assert(string.isAlpha('not really!') === false)
  })

  it('isNumeric', () => {
    assert(string.isNumeric('1234') === true)
    assert(string.isNumeric('1234.0') === false)
    assert(string.isNumeric('not really!') === false)
  })

  it('asciify', () => {
    assert(string.asciify('1234') === '1234')
    assert(string.asciify('Bjørn 10.2.3') === 'Bjrn 10.2.3')
    assert(string.asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ') === 'PHP-MySQL')
    assert(
      string.asciify(
        '[INFO] :谷���新道, ひば���ヶ丘２丁���, ひばりヶ���, 東久留米市 (Higashikurume)'
      ) === '[INFO] :, , ,  (Higashikurume)'
    )
  })

  it('removeAccents', () => {
    assert(string.removeAccents('Antoine de Saint-Exupéry') === 'Antoine de Saint-Exupery')
  })

  it('words', () => {
    assert.deepEqual(string.words('equipmentClassName'), ['equipment', 'Class', 'Name'])
    assert.deepEqual(string.words('equipment class name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment_class_name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment-class-name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment,class,name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment/class/name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment.class.name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment+class+name'), ['equipment', 'class', 'name'])
    assert.deepEqual(string.words('equipment0class0name'), ['equipment', '0', 'class', '0', 'name'])
    assert.deepEqual(string.words('equipment0class0name', '0'), ['equipment', 'class', 'name'])
  })

  it('titleCase', () => {
    assert(string.titleCase('what a sentence') === 'What A Sentence')
  })

  it('sentenceCase', () => {
    assert(string.sentenceCase('test') === 'Test')
    assert(string.sentenceCase('TEST') === 'TEST')
  })

  it('camelCase', () => {
    assert(string.camelCase('equipment class name') === 'equipmentClassName')
    assert(string.camelCase('Equipment Class Name') === 'equipmentClassName')
  })

  it('pascalCase', () => {
    assert(string.pascalCase('equipment class name') === 'EquipmentClassName')
    assert(string.pascalCase('Equipment Class Name') === 'EquipmentClassName')
  })

  it('snakeCase', () => {
    assert(string.snakeCase('equipment class name') === 'equipment_class_name')
    assert(string.snakeCase('equipment-class-name') === 'equipment_class_name')
    assert(string.snakeCase('Equipment Class Name') === 'equipment_class_name')
  })

  it('kebabCase', () => {
    assert(string.kebabCase('equipment class name') === 'equipment-class-name')
    assert(string.kebabCase('equipment_class_name') === 'equipment-class-name')
    assert(string.kebabCase('Equipment Class Name') === 'equipment-class-name')
  })

  it('slugify', () => {
    assert(string.slugify('equipment_class_name') === 'equipment-class-name')
    assert(string.slugify('equipment class name') === 'equipment-class-name')
    assert(string.slugify('Antoine de Saint-Exupéry') === 'Antoine-de-Saint-Exupery')
  })
})
