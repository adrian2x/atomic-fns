import assert from 'assert'
import { IntlDate, strftime } from '../src/i18n/index.js'

const mockDate = (val?, { utc = false, locale = 'en-US' } = {}) =>
  new IntlDate(val, { locale, utc })

describe('IntlDate', () => {
  it('now', () => {
    let date = new Date()
    let testDate = mockDate()
    assert(testDate.year === date.getFullYear())
    assert(testDate.month === date.getMonth() + 1)
    assert(testDate.day === date.getDate())
    assert(testDate.hour === date.getHours())
    assert(testDate.minute === date.getMinutes())
    assert(testDate.second === date.getSeconds())
  })

  it('UTC', () => {
    let date = new Date()
    let testDate = IntlDate.UTC(undefined)
    assert(testDate.year === date.getUTCFullYear())
    assert(testDate.month === date.getUTCMonth() + 1)
    assert(testDate.day === date.getUTCDate())
    assert(testDate.hour === date.getUTCHours())
    assert(testDate.minute === date.getUTCMinutes())
    assert(testDate.second === date.getUTCSeconds())
  })

  it('clone', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date)
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
    let date = IntlDate.unix(946702800)
    assert(date.year === 2000)
    assert(date.month === 1)
    assert(date.day === 1)
    assert(date.dayOfWeek === 6)
    assert(date.dayOfYear() === 1)
  })

  it('create from Object', () => {
    let date = mockDate({ year: 1964, month: 7, day: 2 })
    assert(date.year === 1964)
    assert(date.month === 7)
    assert(date.day === 2)
  })

  it('create from string', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.year === 1964)
    assert(testDate.month === 7)
    assert(testDate.day === 2)
  })

  it('toDate', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.toDate() instanceof Date)
    assert(testDate.toDate().getTime() === date.getTime())
  })

  it('timestamp', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.timestamp() === testDate.toSeconds())
    assert(testDate.timestamp() === testDate.unix())
  })

  it('toSeconds', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.toSeconds() === Math.floor(date.getTime() / 1000))
  })

  it('toISOString', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.toISOString() === date.toISOString())
  })

  it('toISODate', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.toISODate() === date.toISOString().slice(0, 10))
  })

  it('toISOTime', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate(date.toISOString())
    assert(testDate.toISOTime() === date.toISOString().slice(11))
  })

  it('toString', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate('1964-07-02')
    assert(testDate.toString() === date.toLocaleString())
  })

  it('inspect', () => {
    let date = IntlDate.unix(946702800)
    assert(date.inspect() === 'new IntlDate("2000-01-01T05:00:00.000Z")')
  })

  it('toObject', () => {
    let date = new Date()
    let obj = mockDate().toObject()
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
    let date = new Date(2020, 1, 1, 16, 1, 1, 1)
    let d = mockDate(date, { utc: true })
    assert(d.daysInMonth() === 29)
  })

  it('daysInYear', () => {
    let date = new Date(2020, 1, 1, 16, 1, 1, 1)
    let d = mockDate(date, { utc: true })
    assert(d.daysInYear() === 366)
  })

  it('weeksInYear', () => {
    let date = new Date(2020, 1, 1, 16, 1, 1, 1)
    let d = mockDate(date, { utc: true })
    assert(d.week() === 4)
    assert(d.isoWeek() === d.week() + 1)
    assert(d.weeksInYear() === 52)
    assert(d.isoWeeksInYear() === d.weeksInYear() + 1)
  })

  it('isBefore', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate('1964-07-02')
    assert(!testDate.isBefore(date))
    assert(testDate.isBefore(new Date()))
  })

  it('isAfter', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate()
    assert(testDate.isAfter(date))
    assert(!testDate.isAfter(new Date()))
  })

  it('isSame', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate('1964-07-02')
    assert(testDate.isSame(testDate))
    assert(testDate.isSame(date))
  })

  it('compare', () => {
    let date = new Date(1964, 6, 2)
    let testDate = mockDate('1964-07-02')
    assert(testDate.compare(testDate) === 0)
    assert(testDate.compare(date) === 0)
    assert(testDate.compare(new Date()) < 0)
    assert(mockDate().compare(date) > 0)
  })

  it('min', () => {
    let start = new Date(1964, 6, 2)
    let end = mockDate()
    assert(IntlDate.min(start, end) === start)
    assert(IntlDate.min([start, end]) === start)
  })

  it('max', () => {
    let start = new Date(1964, 6, 2)
    let end = mockDate()
    assert(IntlDate.max(start, end) === end)
    assert(IntlDate.max([start, end]) === end)
  })

  it('startOf', () => {
    let date = mockDate('1964-07-02')
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
    let date = mockDate('2020-02-29')
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
    let start = mockDate('2020-02-29')
    let end = start.add({ years: 1 })

    assert(start.isBefore(end))
    assert(end.isAfter(start))
    assert(end.diff(start, 'years') === 1)
    assert(end.diff(start, 'months') === 12)
    assert(end.diff(start, 'months', true) === 12.024887574693526)
    assert(end.diff(start, 'days') === 366)
    assert(end.diff(start, 'days', true) === 366)
  })

  it('to', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = mockDate('2020-02-29')
    assert(start.to(end, 'years') === 'in 55 years')
    assert(end.to(start, 'years') === '55 years ago')
  })

  it('from', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = mockDate('2020-02-29')
    assert(start.from(end, 'years') === '55 years ago')
    assert(end.from(start, 'years') === 'in 55 years')
  })

  it('toNow', () => {
    let date = new Date(1964, 0, 1, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = new Date()
    let years = end.getFullYear() - start.year
    assert(start.toNow('years') === `in ${years} years`)
  })

  it('fromNow', () => {
    let date = new Date(1964, 0, 1, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = new Date()
    let years = end.getFullYear() - start.year
    assert(start.fromNow('years') === `${years} years ago`)
  })

  it('add', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = start.add({ years: 5, months: 5, days: 30 })
    assert(start.isBefore(end))
    assert(end.isAfter(start))
    assert(end.year === 1970)
    assert(end.month === 1)
    assert(end.day === 2)
  })

  it('subtract', () => {
    let date = new Date(1970, 0, 2, 1, 30, 0, 0)
    let start = mockDate(date)
    let end = start.subtract({ years: 5, months: 5, days: 30 })
    assert(start.isAfter(end))
    assert(end.isBefore(start))
    assert(end.year === 1964)
    assert(end.month === 7)
    assert(end.day === 2)
  })

  it('format', () => {
    let date = new Date(2020, 1, 1, 11, 1, 1, 1)
    let d = mockDate(date, { utc: true })
    assert(d.format('YYYY MMMM DD') === '2020 February 01')
    assert(d.format('YYYY MMMM DD dddd') === '2020 February 01 Saturday')
    assert(d.format('ddd, MMM DD, YYYY') === 'Sat, Feb 01, 2020')
    assert(d.format('ddd, MMM DD, YYYY NN') === 'Sat, Feb 01, 2020 AD')
    assert(d.format('ddd, MMM DD, YYYY NNNN') === 'Sat, Feb 01, 2020 Anno Domini')

    // times
    assert(d.format('hh:mm:ss').match(/\d{2}:\d{2}:\d{2}$/))
    assert(d.format('HH:mm:ss').match(/\d{2}:\d{2}:\d{2}$/), d.format('HH:mm:ss'))
    assert(d.format('hh:mm:ss A').match(/\sPM|AM/), d.format('hh:mm:ss A'))
    assert(d.format('h:m:s a').match(/\spm|am/), d.format('h:m:s a'))
    assert(d.format('h:m:s').match(/\d+\:\d+\:\d+$/), d.format('h:m:s'))

    // Localized formats
    // Note: There are some weird space characters inconsistent between node versions
    // which is why the test just checks if the correct parts are included
    assert(d.format('LT').match(/\d+\:\d+\sPM|AM/), d.format('LT'))
    assert(d.format('LTS').match(/\d+\:\d+\:\d+\sPM|AM/), d.format('LTS'))
    assert(d.format('L') === '02/01/2020', d.format('L'))
    assert(d.format('LL') === 'February 1, 2020', d.format('LL'))
    assert(d.format('LLL').includes('February 1, 2020'), d.format('LLL'))
    assert(d.format('LLL').match(/\d+\:\d+\sPM|AM/), d.format('LLL'))
    assert(d.format('LLLL').includes('Saturday, February 1, 2020'), d.format('LLLL'))
    assert(d.format('LLLL').match(/\d+\:\d+\sPM|AM/), d.format('LLLL'))
    assert(d.format('l') === '2/1/2020', d.format('l'))
    assert(d.format('ll') === 'Feb 1, 2020', d.format('ll'))
    assert(d.format('lll').includes('Feb 1, 2020'), d.format('lll'))
    assert(d.format('lll').match(/\d+\:\d+\sPM|AM/), d.format('lll'))
    assert(d.format('llll').includes('Sat, Feb 1, 2020'), d.format('llll'))
    assert(d.format('llll').match(/\d+\:\d+\sPM|AM/), d.format('llll'))
  })

  it('strftime format', () => {
    let date = new Date(2020, 1, 1, 11, 1, 1, 1)
    let d = mockDate(date, { utc: true })
    date = d.toDate()

    assert(strftime('%A', date) === 'Saturday')
    assert(strftime('%a', date) === 'Sat')

    assert(strftime('%d', date) === '01')
    assert(strftime('%-d', date) === '1')

    assert(strftime('%m', date) === '02')
    assert(strftime('%-m', date) === '2')
    assert(strftime('%B', date) === 'February')
    assert(strftime('%b', date) === 'Feb')
    assert(strftime('%bb', date) === '2')

    assert(strftime('%Y', date) === '20')
    assert(strftime('%y', date) === '2020')

    assert(strftime('%N', date) === 'Anno Domini')
    assert(strftime('%n', date) === 'AD')

    assert(strftime('%I', date).match(/\d{2}/), strftime('%I', date))
    assert(strftime('%-I', date).match(/\d+/), strftime('%-I', date))
    assert(strftime('%H', date).match(/\d{2}/), strftime('%H', date))
    assert(strftime('%-H', date).match(/\d+/), strftime('%-H', date))
    assert(strftime('%K', date).match(/\d{2}/), strftime('%K', date))
    assert(strftime('%k', date).match(/\d{2}/), strftime('%k', date))

    assert(strftime('%M', date) === '01', strftime('%M', date))
    assert(strftime('%-M', date) === '1', strftime('%-M', date))

    assert(strftime('%S', date) === '01', strftime('%S', date))
    assert(strftime('%-S', date) === '1', strftime('%-S', date))

    assert(strftime('%A, %d/%m/%y', date) === 'Saturday, 01/02/2020')
    assert(strftime('%y-%m-%d, %A', date) === '2020-02-01, Saturday')
    assert(strftime('%y %B %d %A', date) === '2020 February 01 Saturday')
    assert(strftime('%a, %b %d, %y %n', date) === 'Sat, Feb 01, 2020 AD')
    assert(strftime('%a, %b %d, %y %N', date) === 'Sat, Feb 01, 2020 Anno Domini')

    // times
    assert(strftime('%I:%M:%S', date).match(/\d{2}:\d{2}:\d{2}$/), strftime('%I:%M:%S', date))
    assert(
      strftime('%I:%M:%S %P', date).match(/\d{2}:\d{2}:\d{2}\s*AM|PM$/),
      strftime('%I:%M:%S %P', date)
    )
    assert(
      strftime('%-I:%-M:%-S %p', date).match(/\d+:\d+:\d+\s*am|pm$/),
      strftime('%-I:%-M:%-S %p', date)
    )
    assert(strftime('%H:%M:%S', date).match(/\d{2}:\d{2}:\d{2}$/), strftime('%H:%M:%S', date))
    assert(strftime('%-H:%-M:%-S', date).match(/\d+:\d+:\d+$/), strftime('%-H:%-M:%-S', date))
    // %p has effect on 12h
    assert(
      strftime('%K:%M:%S %P', date).match(/\d+:\d+:\d+\s*AM|PM$/),
      strftime('%K:%M:%S %P', date)
    )
    // %p No effect on 24h
    assert(strftime('%k:%-M:%-S %p', date).match(/\d+:\d+:\d+$/), strftime('%k:%-M:%-S %p', date))
  })
})
