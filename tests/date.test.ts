import { describe, it } from 'vitest'
import assert from 'assert'
import { IntlDate } from '../src/i18n/index.js'

const mockDate = (val?, { utc = false, locale = 'en-US' } = {}) =>
  new IntlDate(val, { locale, utc })

describe('IntlDate', () => {
  it('now', () => {
    const date = new Date()
    const testDate = mockDate()
    assert(testDate.year === date.getFullYear())
    assert(testDate.month === date.getMonth() + 1)
    assert(testDate.day === date.getDate())
    assert(testDate.hour === date.getHours())
    assert(testDate.minute === date.getMinutes())
    assert(testDate.second === date.getSeconds())
  })

  it('UTC', () => {
    const date = new Date()
    const testDate = IntlDate.UTC(undefined)
    assert(testDate.year === date.getUTCFullYear())
    assert(testDate.month === date.getUTCMonth() + 1)
    assert(testDate.day === date.getUTCDate())
    assert(testDate.hour === date.getUTCHours())
    assert(testDate.minute === date.getUTCMinutes())
    assert(testDate.second === date.getUTCSeconds())
  })

  it('clone', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date)
    assert(testDate.isSame(testDate.clone()))
    assert(testDate.clone().isSame(date))
  })

  it('isValid', () => {
    assert(mockDate().isValid())
    assert(mockDate('').isValid() === false)
    assert(mockDate(null).isValid() === false)
    assert(Number.isNaN(mockDate(null).getTime()))
  })

  it('seconds', () => {
    const date = IntlDate.unix(946702800)
    assert(date.year === 2000)
    assert(date.month === 1)
    assert(date.day === 1)
    assert(date.dayOfWeek === 6)
    assert(date.dayOfYear() === 1)
  })

  it('create from Object', () => {
    const date = mockDate({ year: 1964, month: 7, day: 2 })
    assert(date.year === 1964)
    assert(date.month === 7)
    assert(date.day === 2)
  })

  it('create from string', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.year === 1964)
    assert(testDate.month === 7)
    assert(testDate.day === 2)
  })

  it('toDate', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.toDate() instanceof Date)
    assert(testDate.toDate().getTime() === date.getTime())
  })

  it('timestamp', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.timestamp() === testDate.toSeconds())
    assert(testDate.timestamp() === testDate.unix())
  })

  it('toSeconds', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.toSeconds() === Math.floor(date.getTime() / 1000))
  })

  it('toISOString', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.toISOString() === date.toISOString())
  })

  it('toISODate', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.toISODate() === date.toISOString().slice(0, 10))
  })

  it('toISOTime', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    assert(testDate.toISOTime() === date.toISOString().slice(11))
  })

  it('toString', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    assert(testDate.toString() === date.toLocaleString())
  })

  it('inspect', () => {
    const date = IntlDate.unix(946702800)
    assert(date.inspect() === 'new IntlDate("2000-01-01T05:00:00.000Z")')
  })

  it('toObject', () => {
    const date = new Date()
    const obj = mockDate().toObject()
    assert(obj.year === date.getFullYear())
    assert(obj.month === date.getMonth() + 1)
    assert(obj.day === date.getDate())
    assert(obj.hour === date.getHours())
    assert(obj.minute === date.getMinutes())
    assert(obj.second === date.getSeconds())
  })

  it('isLeapYear', () => {
    let testDate = mockDate('2020-02-29')
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)

    testDate = mockDate('2016-02-29')
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)
  })

  it('daysInMonth', () => {
    const date = new Date(2020, 1, 1, 16, 1, 1, 1)
    const d = mockDate(date, { utc: true })
    assert(d.daysInMonth() === 29)
  })

  it('daysInYear', () => {
    const date = new Date(2020, 1, 1, 16, 1, 1, 1)
    const d = mockDate(date, { utc: true })
    assert(d.daysInYear() === 366)
  })

  it('weeksInYear', () => {
    const date = new Date(2020, 1, 1, 16, 1, 1, 1)
    const d = mockDate(date, { utc: true })
    assert(d.week() === 4)
    assert(d.isoWeek() === d.week() + 1)
    assert(d.weeksInYear() === 52)
    assert(d.isoWeeksInYear() === d.weeksInYear() + 1)
  })

  it('isBefore', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    assert(!testDate.isBefore(date))
    assert(testDate.isBefore(new Date()))
  })

  it('isAfter', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate()
    assert(testDate.isAfter(date))
    assert(!testDate.isAfter(new Date()))
  })

  it('isSame', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    assert(testDate.isSame(testDate))
    assert(testDate.isSame(date))
  })

  it('compare', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    assert(testDate.compare(testDate) === 0)
    assert(testDate.compare(date) === 0)
    assert(testDate.compare(new Date()) < 0)
    assert(mockDate().compare(date) > 0)
  })

  it('min', () => {
    const start = new Date(1964, 6, 2)
    const end = mockDate()
    assert(IntlDate.min(start, end) === start)
    assert(IntlDate.min([start, end]) === start)
  })

  it('max', () => {
    const start = new Date(1964, 6, 2)
    const end = mockDate()
    assert(IntlDate.max(start, end) === end)
    assert(IntlDate.max([start, end]) === end)
  })

  it('startOf', () => {
    const date = mockDate('1964-07-02')
    assert(date.startOf('year').year === 1964)
    assert(date.startOf('year').month === 1)
    assert(date.startOf('year').day === 1)
    assert(date.startOf('month').month === 7)
    assert(date.startOf('month').day === 1)
    assert(date.startOf('day').day === 2)
    assert(date.startOf('day').hour === 0)
    assert(date.startOf('day').minute === 0)
    assert(date.startOf('day').second === 0)
    assert(date.startOf('hour').minute === 0)
    assert(date.startOf('hour').second === 0)
    assert(date.startOf('minute').second === 0)
    assert(date.startOf('minute').millisecond === 0)
    assert(date.startOf('second').millisecond === 0)
  })

  it('endOf', () => {
    const date = mockDate('2020-02-29')
    assert(date.endOf('year').year === 2020)
    assert(date.endOf('year').month === 12)
    assert(date.endOf('year').day === 31)
    assert(date.endOf('month').month === 2)
    assert(date.endOf('month').day === 29)
    assert(date.endOf('day').day === 29)
    assert(date.endOf('day').hour === 23)
    assert(date.endOf('day').minute === 59)
    assert(date.endOf('day').second === 59)
    assert(date.endOf('hour').minute === 59)
    assert(date.endOf('hour').second === 59)
    assert(date.endOf('minute').second === 59)
    assert(date.endOf('minute').millisecond === 999)
    assert(date.endOf('second').millisecond === 999)
  })

  it('diff', () => {
    const start = mockDate('2020-02-29')
    const end = start.add({ years: 1 })
    assert(end.isAfter(start))
    assert(start.isBefore(end))
    assert(end.diff(start, 'years') === 1)
    assert(end.diff(start, 'months') === 12)
    assert(end.diff(start, 'months', true) === 12.024887574693526)
    assert(end.diff(start, 'days') === 366)
    assert(end.diff(start, 'days', true) === 366)
  })

  it('to', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = mockDate('2020-02-29')
    assert(start.to(end, 'years') === 'in 55 years')
    assert(end.to(start, 'years') === '55 years ago')
  })

  it('from', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = mockDate('2020-02-29')
    assert(start.from(end, 'years') === '55 years ago')
    assert(end.from(start, 'years') === 'in 55 years')
  })

  it('toNow', () => {
    const now = mockDate()
    const start = now.subtract({ years: 33 })
    assert(start.toNow('years') === `in 33 years`)
  })

  it('fromNow', () => {
    const now = mockDate()
    const start = now.subtract({ years: 33 })
    assert(start.fromNow('years') === `33 years ago`)
  })

  it('add', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = start.add({ years: 5, months: 5, days: 30 })
    assert(end.isAfter(start))
    assert(start.isBefore(end))
    assert(end.year === 1970)
    assert(end.month === 1)
    assert(end.day === 2)
  })

  it('subtract', () => {
    const date = new Date(1970, 0, 2, 1, 30, 0, 0)
    const start = mockDate(date)
    const end = start.subtract({ years: 5, months: 5, days: 30 })
    assert(end.isBefore(start))
    assert(start.isAfter(end))
    assert(end.year === 1964)
    assert(end.month === 7)
    assert(end.day === 2)
  })
})
