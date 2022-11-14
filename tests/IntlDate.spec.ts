import assert from 'assert'
import { IntlDate, strftime } from '../src/i18n/index.js'

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
    let testDate = new IntlDate('1964-07-02')
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
    let testDate = new IntlDate('2020-02-29')
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)

    testDate = new IntlDate('2016-02-29')
    assert(testDate.isLeapYear())
    assert(testDate.month == 2)
    assert(testDate.day == 29)
  })

  it('isBefore', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate('1964-07-02')
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
    let testDate = new IntlDate('1964-07-02')
    assert(testDate.isSame(testDate))
    assert(testDate.isSame(date))
  })

  it('compare', () => {
    let date = new Date(1964, 6, 2)
    let testDate = new IntlDate('1964-07-02')
    assert(testDate.compare(testDate) === 0)
    assert(testDate.compare(date) === 0)
    assert(testDate.compare(new Date()) < 0)
    assert(new IntlDate().compare(date) > 0)
  })

  it('min', () => {
    let start = new Date(1964, 6, 2)
    let end = new IntlDate()
    assert(IntlDate.min(start, end) === start)
    assert(IntlDate.min([start, end]) === start)
  })

  it('max', () => {
    let start = new Date(1964, 6, 2)
    let end = new IntlDate()
    assert(IntlDate.max(start, end) === end)
    assert(IntlDate.max([start, end]) === end)
  })

  it('startOf', () => {
    let date = new IntlDate('1964-07-02')
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
    let date = new IntlDate('2020-02-29')
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
    let start = new IntlDate('2020-02-29')
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
    let start = new IntlDate(date)
    let end = new IntlDate('2020-02-29')
    assert(start.to(end, 'years') === 'in 55 years')
    assert(end.to(start, 'years') === '55 years ago')
  })

  it('from', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = new IntlDate(date)
    let end = new IntlDate('2020-02-29')
    assert(start.from(end, 'years') === '55 years ago')
    assert(end.from(start, 'years') === 'in 55 years')
  })

  it('toNow', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = new IntlDate(date)
    let end = new Date()
    let years = end.getFullYear() - start.year
    assert(start.toNow('years') === `in ${years} years`)
  })

  it('fromNow', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = new IntlDate(date)
    let end = new Date()
    let years = end.getFullYear() - start.year
    assert(start.fromNow('years') === `${years} years ago`)
  })

  it('add', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = new IntlDate(date)
    let end = start.add({ years: 5, months: 5, days: 30 })
    assert(start.isBefore(end))
    assert(end.isAfter(start))
    assert(end.year === 1970)
    assert(end.month === 1)
    assert(end.day === 2)
    assert(end.hour === 1)
    assert(end.minute === 30)
    assert(end.second === 0)
    assert(end.millisecond === 0)
  })

  it('subtract', () => {
    let date = new Date(1970, 0, 2, 1, 30, 0, 0)
    let start = new IntlDate(date)
    let end = start.subtract({ years: 5, months: 5, days: 30 })
    assert(start.isAfter(end))
    assert(end.isBefore(start))
    assert(end.year === 1964)
    assert(end.month === 7)
    assert(end.day === 2)
    assert(end.hour === 2)
    assert(end.minute === 30)
    assert(end.second === 0)
    assert(end.millisecond === 0)
  })

  it('format', () => {
    let date = new Date(2020, 1, 1, 16, 1, 1, 1)
    let d = new IntlDate(date, { utc: true, locale: 'en' })
    assert(d.format('YYYY MMMM DD dddd hh:mm:ss A') === '2020 February 01 Saturday 09:01:01 PM')
    assert(d.format('YYYY MMMM DD dddd h:m:s a') === '2020 February 01 Saturday 9:1:1 pm')
    assert(d.format('YYYY MMM DD ddd HH:mm:ss') === '2020 Feb 01 Sat 21:01:01')
    assert(d.format('YYYY MMM DD ddd H:m:s') === '2020 Feb 01 Sat 21:1:1')
    assert(d.format('YYYY MMM DD ddd hh:mm:ss A') === '2020 Feb 01 Sat 09:01:01 PM')
    assert(d.format('YYYY MMM DD ddd HH:m:s a') === '2020 Feb 01 Sat 21:1:1 pm')
    assert(
      d.format('ddd, MMM DD, YYYY NNNN, hh:mm:ss A') ===
        'Sat, Feb 01, 2020 Anno Domini, 09:01:01 PM'
    )
    assert(d.format('ddd, MMM DD, YYYY NN, hh:mm:ss A') === 'Sat, Feb 01, 2020 AD, 09:01:01 PM')
    assert(d.format('ddd, MMM DD, YYYY HH:mm:ss') === 'Sat, Feb 01, 2020 21:01:01')
    assert(
      d.format('YYYY MMM DD ddd h:mm:ss A zzz') ===
        '2020 Feb 01 Sat 9:01:01 PM Eastern Standard Time'
    )
    assert(d.format('YYYY MMM DD ddd h:mm:ss A z') === '2020 Feb 01 Sat 9:01:01 PM EST')
  })

  it('strftime format', () => {
    let date = new Date(2020, 1, 1, 16, 1, 1, 1)
    let d = new IntlDate(date, { utc: true, locale: 'en' })
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

    assert(strftime('%I', date) === '09')
    assert(strftime('%-I', date) === '9')
    assert(strftime('%H', date) === '21')
    assert(strftime('%-H', date) === '21')
    assert(strftime('%K', date) === '09')
    assert(strftime('%k', date) === '21')

    assert(strftime('%M', date) === '01')
    assert(strftime('%-M', date) === '1')

    assert(strftime('%S', date) === '01')
    assert(strftime('%-S', date) === '1')

    assert(strftime('%pp', date) === 'at night')

    assert(strftime('%Z', date) === 'Eastern Standard Time')
    assert(strftime('%-Z', date) === 'EST')

    assert(strftime('%A, %d/%m/%y', date) === 'Saturday, 01/02/2020')
    assert(strftime('%y-%m-%d, %A', date) === '2020-02-01, Saturday')
    assert(strftime('%y %B %d %A %I:%M:%S %P', date) === '2020 February 01 Saturday 09:01:01 PM')
    assert(strftime('%y %B %d %A %-I:%-M:%-S %p', date) === '2020 February 01 Saturday 9:1:1 PM')
    assert(strftime('%y %b %d %a %H:%M:%S', date) === '2020 Feb 01 Sat 21:01:01')
    assert(strftime('%y %b %d %a %-H:%-M:%-S', date) === '2020 Feb 01 Sat 21:1:1')
    assert(strftime('%y %b %d %a %K:%M:%S %P', date) === '2020 Feb 01 Sat 09:01:01 PM') // %p shows on 12h clock
    assert(strftime('%y %b %d %a %k:%-M:%-S %p', date) === '2020 Feb 01 Sat 21:1:1') // %p No effect on 24h
    assert(
      strftime('%a, %b %d, %y %N, %K:%M:%S %P', date) ===
        'Sat, Feb 01, 2020 Anno Domini, 09:01:01 PM'
    )
    assert(strftime('%a, %b %d, %y %n, %K:%M:%S %P', date) === 'Sat, Feb 01, 2020 AD, 09:01:01 PM')
    assert(strftime('%a, %b %d, %y %k:%M:%S %P', date) === 'Sat, Feb 01, 2020 21:01:01') // %p No effect on 24h
    assert(
      strftime('%y %b %d %a %-I:%M:%S %P %Z', date) ===
        '2020 Feb 01 Sat 9:01:01 PM Eastern Standard Time'
    )
    assert(strftime('%y %b %d %a %-I:%M:%S %P %-Z', date) === '2020 Feb 01 Sat 9:01:01 PM EST')
  })
})
