import assert from 'assert'
import { IntlDate } from '../src/i18n/index.js'

describe('IntlDate', () => {
  it('now', () => {
    let date = new Date()
    let testDate = new IntlDate()
    assert(testDate.year === date.getFullYear())
    assert(testDate.month === date.getMonth() + 1)
    assert(testDate.day === date.getDate())
    assert(testDate.hour === date.getHours())
    assert(testDate.minute === date.getMinutes())
    assert(testDate.second === date.getSeconds())
  })

  it('UTC', () => {
    let date = new Date()
    let testDate = IntlDate.UTC()
    assert(testDate.year === date.getUTCFullYear())
    assert(testDate.month === date.getUTCMonth() + 1)
    assert(testDate.day === date.getUTCDate())
    assert(testDate.hour === date.getUTCHours())
    assert(testDate.minute === date.getUTCMinutes())
    assert(testDate.second === date.getUTCSeconds())
  })

  it('clone', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(testDate.isSame(testDate.clone()))
    assert(testDate.clone().isSame(date))
  })

  it('isValid', () => {
    assert(new IntlDate().isValid())
    assert(new IntlDate('').isValid() === false)
  })

  it('seconds', () => {
    let date = IntlDate.unix(946702800)
    assert(date.year === 2000)
    assert(date.month === 1)
    assert(date.day === 1)
  })

  it('create from Object', () => {
    let date = new IntlDate({ year: 1964, month: 7, day: 2 })
    assert(date.year === 1964)
    assert(date.month === 7)
    assert(date.day === 2)
  })

  it('create from string', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.year === 1964)
    assert(testDate.month === 7)
    assert(testDate.day === 2)
  })

  it('toDate', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.toDate() instanceof Date)
    assert(testDate.toDate().getTime() === date.getTime())
  })

  it('timestamp', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.timestamp() === testDate.toSeconds())
    assert(testDate.timestamp() === testDate.unix())
  })

  it('toSeconds', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.toSeconds() === Math.floor(date.getTime() / 1000))
  })

  it('toISOString', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.toISOString() === date.toISOString())
  })

  it('toISODate', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.toISODate() === date.toISOString().slice(0, 10))
  })

  it('toISOTime', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date.toISOString())
    assert(testDate.toISOTime() === date.toISOString().slice(11))
  })

  it('toString', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(testDate.toString() === date.toLocaleString())
  })

  it('toObject', () => {
    let date = new Date()
    let obj = new IntlDate().toObject()
    assert(obj.year === date.getFullYear())
    assert(obj.month === date.getMonth() + 1)
    assert(obj.day === date.getDate())
    assert(obj.hour === date.getHours())
    assert(obj.minute === date.getMinutes())
    assert(obj.second === date.getSeconds())
  })

  it('isLeapYear', () => {
    let testDate = new IntlDate(new Date(2020, 1, 29))
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)
    testDate = new IntlDate(new Date(2016, 1, 29))
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)
  })

  it('isBefore', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(!testDate.isBefore(date))
    assert(testDate.isBefore(new Date()))
  })

  it('isAfter', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate()
    assert(testDate.isAfter(date))
    assert(!testDate.isAfter(new Date()))
  })

  it('isSame', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(testDate.isSame(testDate))
    assert(testDate.isSame(date))
  })

  it('compare', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(testDate.compare(testDate) === 0)
    assert(testDate.compare(date) === 0)
    assert(testDate.compare(new Date()) < 0)
    assert(new IntlDate().compare(date) > 0)
  })

  it('startOf', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate(date)
    assert(testDate.startOf('year').year === 1964)
    assert(testDate.startOf('year').month === 1)
    assert(testDate.startOf('year').day === 1)
    assert(testDate.startOf('month').month === 7)
    assert(testDate.startOf('month').day === 1)
    assert(testDate.startOf('day').day === 2)
    assert(testDate.startOf('day').hour === 0)
    assert(testDate.startOf('day').minute === 0)
    assert(testDate.startOf('day').second === 0)
  })

  it('endOf', () => {
    let date = new Date(2020, 1, 29)
    let testDate = new IntlDate(date)
    assert(testDate.endOf('year').year === 2020)
    assert(testDate.endOf('year').month === 12)
    assert(testDate.endOf('year').day === 31)
    assert(testDate.endOf('month').month === 2)
    assert(testDate.endOf('month').day === 29)
    assert(testDate.endOf('day').day === 29)
    assert(testDate.endOf('day').hour === 23)
    assert(testDate.endOf('day').minute === 59)
    assert(testDate.endOf('day').second === 59)
  })
})
