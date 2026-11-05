import assert from 'assert'
import { dayOfYear, weekOfYear } from '../src/i18n/date/utils.js'
import {
  addDuration,
  asDate,
  daysInMonth,
  Duration,
  formatDate,
  IntlDate,
  maxDate,
  minDate,
  strftime,
  subDuration
} from '../src/i18n/index.js'

const mockDate = (val?, { utc = false, locale = 'en-US' } = {}) =>
  new IntlDate(val, { locale, utc })

const at = (year, month, day, hour = 0, minute = 0) =>
  mockDate(new Date(year, month, day, hour, minute))

const clock = (date: IntlDate) => date.format('YYYY-MM-DD HH:mm Z')

const inZone = (zone: string, test: () => void) => {
  const previous = process.env.TZ
  process.env.TZ = zone
  try {
    test()
  } finally {
    process.env.TZ = previous
  }
}

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

  it('invalid dates give NaN from diff and Invalid Date from relative text', () => {
    const invalid = mockDate('garbage')
    assert(Number.isNaN(invalid.diff(new Date())))
    assert(Number.isNaN(mockDate().diff('garbage', 'days')))
    assert.strictEqual(invalid.from(new Date()), 'Invalid Date')
    assert.strictEqual(mockDate().to('garbage'), 'Invalid Date')
    assert.strictEqual(invalid.fromNow(), 'Invalid Date')
    assert.strictEqual(invalid.toNow(), 'Invalid Date')
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
    assert(end.isAfter(start))
    assert(start.isBefore(end))
    assert(end.diff(start, 'years') === 1)
    assert(end.diff(start, 'months') === 12)
    assert(end.diff(start, 'months', true) === 11.992032690609664)
    assert(end.diff(start, 'days') === 365)
    assert(end.diff(start, 'days', true) === 365)
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
    let now = mockDate()
    let start = now.subtract({ years: 33 })
    assert(start.toNow('years') === `in 33 years`)
  })

  it('fromNow', () => {
    let now = mockDate()
    let start = now.subtract({ years: 33 })
    assert(start.fromNow('years') === `33 years ago`)
  })

  it('add', () => {
    let date = new Date(1964, 6, 2, 2, 30, 0, 0)
    let start = mockDate(date)
    let end = start.add({ years: 5, months: 5, days: 30 })
    assert(end.isAfter(start))
    assert(start.isBefore(end))
    assert(end.year === 1970)
    assert(end.month === 1)
    assert(end.day === 1)
  })

  it('subtract', () => {
    let date = new Date(1970, 0, 2, 1, 30, 0, 0)
    let start = mockDate(date)
    let end = start.subtract({ years: 5, months: 5, days: 30 })
    assert(end.isBefore(start))
    assert(start.isAfter(end))
    assert(end.year === 1964)
    assert(end.month === 7)
    assert(end.day === 3)
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

  it('format Z and ZZ print the numeric offset', () => {
    let date = mockDate('2020-02-01T11:01:01')
    assert.strictEqual(date.format('Z'), '+00:00')
    assert.strictEqual(date.format('ZZ'), '+0000')
    assert.strictEqual(date.format(''), '2020-02-01T11:01:01+00:00')
    assert.strictEqual(mockDate(date.format('')).getTime(), date.getTime())
    assert.strictEqual(date.zone(), 'GMT+00:00')

    inZone('America/New_York', () => {
      date = mockDate('2020-02-01T11:01:01')
      assert.strictEqual(date.format('Z ZZ'), '-05:00 -0500')
      assert.strictEqual(date.format(''), '2020-02-01T11:01:01-05:00')
      assert.strictEqual(mockDate(date.format('')).getTime(), date.getTime())
      assert.strictEqual(date.zone(), 'GMT-05:00')
    })

    inZone('Asia/Kolkata', () => {
      assert.strictEqual(mockDate('2020-02-01T11:01:01').format('Z ZZ'), '+05:30 +0530')
    })
  })

  it('format prints zero values', () => {
    const midnight = mockDate(new Date(2021, 0, 3, 0, 0, 0, 0))
    assert.strictEqual(midnight.format('H:m:s d'), '0:0:0 0')
    assert.strictEqual(mockDate(0).format('X x'), '0 0')
  })

  it('format leaves unknown tokens alone', () => {
    assert.strictEqual(mockDate().format('Y YYY dd zz zzzz'), 'Y YYY dd zz zzzz')
  })

  it('format pads the year', () => {
    const inYear = (year: number) => {
      const date = new Date(2021, 5, 15)
      date.setFullYear(year)
      return mockDate(date).format('YYYY YY')
    }
    assert.strictEqual(inYear(5), '0005 05')
    assert.strictEqual(inYear(50), '0050 50')
    assert.strictEqual(inYear(999), '0999 99')
    assert.strictEqual(inYear(2021), '2021 21')
    assert.strictEqual(inYear(12345), '12345 45')
    assert.strictEqual(inYear(-1), '-0001 01')
  })

  it('format Do prints an ordinal day', () => {
    const ordinals = {
      1: '1st',
      2: '2nd',
      3: '3rd',
      4: '4th',
      11: '11th',
      12: '12th',
      13: '13th',
      21: '21st',
      22: '22nd',
      23: '23rd',
      30: '30th',
      31: '31st'
    }
    for (const [day, ordinal] of Object.entries(ordinals)) {
      assert.strictEqual(mockDate(new Date(2021, 0, Number(day))).format('Do'), ordinal)
    }
    const date = new Date(2021, 0, 2)
    assert.strictEqual(mockDate(date).format('MMMM Do, YYYY'), 'January 2nd, 2021')
    assert.strictEqual(mockDate(date).format('[Do] DD'), 'Do 02')
    assert.strictEqual(mockDate(date, { locale: 'de-DE' }).format('Do'), '2')
  })

  it('invalid dates format as Invalid Date', () => {
    const invalid = mockDate('garbage')
    assert.strictEqual(formatDate('YYYY', new Date(NaN)), 'Invalid Date')
    assert.strictEqual(strftime('%y', new Date(NaN)), 'Invalid Date')
    assert.strictEqual(invalid.format('YYYY'), 'Invalid Date')
    assert.strictEqual(invalid.zone(), 'Invalid Date')
    assert.strictEqual(invalid.zoneName(), 'Invalid Date')
    assert.strictEqual(invalid.inspect(), 'new IntlDate(NaN)')
  })

  it('era and zone names read their own part in every locale', () => {
    const date = new Date(2021, 5, 15)
    assert.strictEqual(formatDate('N', date, 'ja-JP'), '西暦')
    assert.strictEqual(formatDate('NNNN', date, 'zh-CN'), '公元')
    assert.strictEqual(formatDate('NNNN', date, 'ko-KR'), '서기')
    assert.strictEqual(formatDate('N', date, 'th-TH'), 'พ.ศ.')
    assert.strictEqual(formatDate('z zzz', date, 'th-TH'), 'UTC เวลาสากลเชิงพิกัด')
    assert.strictEqual(strftime('%n %N', date, 'ja-JP'), '西暦 西暦')
    assert.strictEqual(strftime('%-Z %Z', date, 'th-TH'), 'UTC เวลาสากลเชิงพิกัด')
  })

  it('strftime keeps unknown directives and a lone % as written', () => {
    const date = new Date(2020, 1, 1)
    assert.strictEqual(strftime('100%', date), '100%')
    assert.strictEqual(strftime('%', date), '%')
    assert.strictEqual(strftime('%-', date), '%-')
    assert.strictEqual(strftime('%Q', date), '%Q')
    assert.strictEqual(strftime('%-Q', date), '%-Q')
    assert.strictEqual(strftime('%Q %d', date), '%Q 01')
    assert.strictEqual(strftime('%%d', date), '%d')
  })

  it('strftime reads a repeated letter after a directive as text', () => {
    const date = new Date(2020, 1, 1)
    assert.strictEqual(strftime('%dd', date), '01d')
    assert.strictEqual(strftime('%mm/%dd', date), '02m/01d')
    assert.strictEqual(strftime('%bbb', date), '2b')
    assert.strictEqual(strftime('%ZZ', date), 'Coordinated Universal TimeZ')
    assert.strictEqual(strftime('%d%d', date), '0101')
  })

  it('strftime does not throw on %aa and %nn', () => {
    const date = new Date(2020, 1, 1)
    assert.strictEqual(strftime('%aa', date), 'Sata')
    assert.strictEqual(strftime('%nn', date), 'ADn')
  })

  it('strftime fills every %p and %P', () => {
    const date = new Date(2020, 1, 1, 13, 5)
    assert.strictEqual(strftime('%I %p %p', date), '01 pm pm')
    assert.strictEqual(strftime('%I %P %p', date), '01 PM pm')
    assert.strictEqual(strftime('%p %I', date), 'pm 01')
    assert.strictEqual(strftime('%P %I', date), 'PM 01')
  })

  it('strftime %-H drops the leading zero', () => {
    assert.strictEqual(strftime('%-H', new Date(2020, 1, 1, 1)), '1')
    assert.strictEqual(strftime('%-H', new Date(2020, 1, 1, 0)), '0')
    assert.strictEqual(strftime('%-H', new Date(2020, 1, 1, 13)), '13')
    assert.strictEqual(strftime('%H', new Date(2020, 1, 1, 1)), '01')
    assert.strictEqual(strftime('%-H', new Date(2020, 1, 1, 1), 'ar-EG'), '١')
  })

  it('strftime numeric directives leave out the unit text of the locale', () => {
    const date = new Date(2021, 5, 15, 9, 5, 3)
    assert.strictEqual(strftime('%H:%M', date, 'de-DE'), '09:05')
    assert.strictEqual(strftime('%H:%M', date, 'fr-FR'), '09:05')
    assert.strictEqual(strftime('%y/%m/%d', date, 'ja-JP'), '2021/06/15')
    assert.strictEqual(strftime('%y', date, 'th-TH'), '2564')
    assert.strictEqual(strftime('%I %P', date, 'ko-KR'), '09 오전')
    assert.strictEqual(strftime('%I %P', date, 'ja-JP'), '09 午前')
    assert.strictEqual(strftime('%-H', date, 'de-DE'), '9')
    assert.strictEqual(strftime('%B', date, 'ja-JP'), '6月')
  })

  it('asDate reads a fraction of a second', () => {
    assert.strictEqual(asDate('2020-01-01T00:00:00.5').getMilliseconds(), 500)
    assert.strictEqual(asDate('2020-01-01T00:00:00.05').getMilliseconds(), 50)
    assert.strictEqual(asDate('2020-01-01T00:00:00.123456').getMilliseconds(), 123)
    assert.strictEqual(asDate('2020-01-01T00:00:00.5', true).getUTCMilliseconds(), 500)
    assert.strictEqual(asDate('2020-01-01T00:00:00').getMilliseconds(), 0)
  })

  it('asDate keeps years under 100', () => {
    const fields = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    assert.deepStrictEqual(fields(asDate('0050-06-15')), [50, 6, 15])
    assert.deepStrictEqual(fields(asDate('0000-02-29')), [0, 2, 29])
    assert.strictEqual(
      asDate('0099-12-31T10:00:00', true).toISOString(),
      '0099-12-31T10:00:00.000Z'
    )
    assert.deepStrictEqual(fields(asDate('1999-12-31')), [1999, 12, 31])
  })

  it('asDate with utc reads every field from the same instant', () => {
    const fields = (text: string) => {
      const date = asDate(new Date(text), true)
      return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]
    }

    inZone('America/New_York', () => {
      assert.deepStrictEqual(fields('2021-02-01T04:00:00Z'), [2021, 2, 1, 4])
      assert.deepStrictEqual(fields('2021-04-01T02:00:00Z'), [2021, 4, 1, 2])
      assert.strictEqual(IntlDate.UTC(new Date('2021-02-01T04:00:00Z')).month, 2)
    })

    inZone('Asia/Kolkata', () => {
      assert.deepStrictEqual(fields('2021-12-31T23:00:00Z'), [2021, 12, 31, 23])
      assert.deepStrictEqual(fields('2020-02-29T23:00:00Z'), [2020, 2, 29, 23])
    })

    assert.deepStrictEqual(fields('0050-06-15T12:00:00Z'), [50, 6, 15, 12])
  })

  it('add clamps to the last day of a shorter month', () => {
    const day = (date: IntlDate) => date.format('YYYY-MM-DD')
    assert.strictEqual(day(mockDate('2021-01-31').add({ months: 1 })), '2021-02-28')
    assert.strictEqual(day(mockDate('2020-01-31').add({ months: 1 })), '2020-02-29')
    assert.strictEqual(day(mockDate('2021-03-31').subtract({ months: 1 })), '2021-02-28')
    assert.strictEqual(day(mockDate('2021-10-31').add({ months: 1 })), '2021-11-30')
    assert.strictEqual(day(mockDate('2020-02-29').add({ years: 1 })), '2021-02-28')
    assert.strictEqual(day(mockDate('2020-02-29').subtract({ years: 1 })), '2019-02-28')
    assert.strictEqual(day(mockDate('2020-02-29').add({ years: 4 })), '2024-02-29')
    assert.strictEqual(day(mockDate('2021-11-30').add({ quarters: 1 })), '2022-02-28')
    assert.strictEqual(day(mockDate('2021-01-15').add({ months: 13 })), '2022-02-15')
    assert.strictEqual(day(mockDate('2021-01-15').add({ months: -13 })), '2019-12-15')
  })

  it('endOf stays in the current month and quarter', () => {
    const end = (date: string, unit) => mockDate(date).endOf(unit).format('YYYY-MM-DD')
    for (const date of ['2021-01-29', '2021-01-30', '2021-01-31']) {
      assert.strictEqual(end(date, 'month'), '2021-01-31')
    }
    assert.strictEqual(end('2021-03-31', 'month'), '2021-03-31')
    assert.strictEqual(end('2021-08-31', 'month'), '2021-08-31')
    assert.strictEqual(end('2021-03-31', 'quarter'), '2021-03-31')
    assert.strictEqual(end('2021-12-31', 'quarter'), '2021-12-31')
  })

  it('calendar units keep the wall clock across DST', () => {
    inZone('America/New_York', () => {
      assert.strictEqual(clock(at(2021, 2, 13, 12).add({ days: 1 })), '2021-03-14 12:00 -04:00')
      assert.strictEqual(clock(at(2021, 2, 13, 12).add({ weeks: 1 })), '2021-03-20 12:00 -04:00')
      assert.strictEqual(clock(at(2021, 0, 15, 12).add({ months: 6 })), '2021-07-15 12:00 -04:00')
      assert.strictEqual(
        clock(at(2021, 6, 15, 12).subtract({ months: 6 })),
        '2021-01-15 12:00 -05:00'
      )
      assert.strictEqual(clock(at(2021, 10, 6, 12).add({ days: 1 })), '2021-11-07 12:00 -05:00')
      assert.strictEqual(clock(at(2021, 2, 13, 2, 30).add({ days: 1 })), '2021-03-14 03:30 -04:00')
    })

    inZone('Pacific/Auckland', () => {
      assert.strictEqual(clock(at(2021, 8, 25, 12).add({ days: 1 })), '2021-09-26 12:00 +13:00')
      assert.strictEqual(clock(at(2021, 3, 3, 12).add({ days: 1 })), '2021-04-04 12:00 +12:00')
    })
  })

  it('time units count exact time across DST', () => {
    inZone('America/New_York', () => {
      assert.strictEqual(clock(at(2021, 2, 14, 1, 30).add({ hours: 1 })), '2021-03-14 03:30 -04:00')
      assert.strictEqual(
        clock(at(2021, 2, 14, 1, 30).add({ minutes: 30 })),
        '2021-03-14 03:00 -04:00'
      )
      assert.strictEqual(
        clock(at(2021, 2, 14, 3, 30).subtract({ hours: 1 })),
        '2021-03-14 01:30 -05:00'
      )
      assert.strictEqual(clock(at(2021, 10, 7, 0, 30).add({ hours: 2 })), '2021-11-07 01:30 -05:00')

      const secondPass = mockDate(new Date('2021-11-07T06:30:00Z'))
      assert.strictEqual(clock(secondPass.add({ minutes: 10 })), '2021-11-07 01:40 -05:00')
      assert.strictEqual(clock(secondPass.subtract({ hours: 1 })), '2021-11-07 01:30 -04:00')
      assert.strictEqual(clock(secondPass.add({ days: 0, hours: 1 })), '2021-11-07 02:30 -05:00')
    })
  })

  it('endOf stays in the current day and month across DST', () => {
    const end = (date: IntlDate, unit) => date.endOf(unit).format('YYYY-MM-DD HH:mm:ss.SSS')
    inZone('America/New_York', () => {
      assert.strictEqual(end(at(2021, 10, 7, 0, 30), 'day'), '2021-11-07 23:59:59.999')
      assert.strictEqual(end(at(2021, 2, 13, 23, 30), 'day'), '2021-03-13 23:59:59.999')
      assert.strictEqual(end(at(2021, 10, 1, 0, 30), 'month'), '2021-11-30 23:59:59.999')
    })
  })

  it('add applies every unit as written, largest first', () => {
    const day = (date: IntlDate) => date.format('YYYY-MM-DD')
    const start = mockDate('2021-01-15')
    assert.strictEqual(day(start.add({ months: 1, days: 30 })), '2021-03-17')
    assert.strictEqual(day(start.add({ days: 30, months: 1 })), '2021-03-17')
    assert.strictEqual(day(start.add({ years: 1, months: '2' })), '2022-03-15')
    assert.strictEqual(day(start.add({ months: 1, days: 45 })), '2021-04-01')
    assert.strictEqual(day(start.add({ years: 1, months: 13, days: 400 })), '2024-03-21')
    assert.strictEqual(day(mockDate('2021-01-31').add({ days: 1, months: 1 })), '2021-03-01')
    assert.strictEqual(day(mockDate('2020-02-29').add({ years: 1, months: 1 })), '2021-03-29')
  })

  it('add and subtract treat a fraction the same in both directions', () => {
    const time = (date: IntlDate) => date.format('YYYY-MM-DD HH:mm')
    const noon = mockDate('2021-01-15T12:00:00')
    assert.strictEqual(time(noon.add({ hours: 1.5 })), '2021-01-15 13:30')
    assert.strictEqual(time(noon.subtract({ hours: 1.5 })), '2021-01-15 10:30')
    assert.strictEqual(time(noon.add({ hours: -0.5 })), '2021-01-15 11:30')
    assert.strictEqual(noon.add({ milliseconds: '5' }).millisecond, 5)
    assert.strictEqual(time(noon.add({ weeks: 1, days: '1' })), '2021-01-23 12:00')
    assert.strictEqual(time(noon.add({ days: 1.5 })), '2021-01-16 12:00')
    assert.strictEqual(time(noon.subtract({ days: 1.5 })), '2021-01-14 12:00')
    assert.strictEqual(time(noon.add({ weeks: 1.5 })), '2021-01-25 12:00')
    assert.strictEqual(time(noon.add({ years: 1.5 })), '2022-07-15 12:00')
    assert.strictEqual(time(noon.subtract({ months: 1.5 })), '2020-12-15 12:00')
    assert.strictEqual(noon.add({ days: NaN }).isValid(), false)
  })

  it('set clamps the day to the target month', () => {
    const day = (date: IntlDate) => date.format('YYYY-MM-DD')
    assert.strictEqual(day(mockDate('2021-01-31').set({ month: 2 })), '2021-02-28')
    assert.strictEqual(day(mockDate('2021-03-31').set({ month: 4 })), '2021-04-30')
    assert.strictEqual(day(mockDate('2020-02-29').set({ year: 2021 })), '2021-02-28')
    assert.strictEqual(day(mockDate('2021-02-28').set({ month: 3 })), '2021-03-28')
    assert.strictEqual(day(mockDate('2021-01-31').set({ month: 2, day: 31 })), '2021-03-03')
  })

  it('startOf week and set weekday move within this week', () => {
    const full = (date: IntlDate) => date.format('YYYY-MM-DD HH:mm:ss.SSS')
    const friday = mockDate('2021-01-15T13:05:09')
    assert.strictEqual(full(friday.startOf('week')), '2021-01-11 00:00:00.000')
    assert.strictEqual(full(friday.endOf('week')), '2021-01-17 23:59:59.999')
    assert.strictEqual(
      full(mockDate('2021-01-17T13:00:00').startOf('week')),
      '2021-01-11 00:00:00.000'
    )
    assert.strictEqual(
      full(mockDate('2021-01-11T13:00:00').startOf('week')),
      '2021-01-11 00:00:00.000'
    )
    assert.strictEqual(
      full(mockDate('2021-01-01T00:00:00').startOf('week')),
      '2020-12-28 00:00:00.000'
    )
    assert.strictEqual(full(friday.set({ weekday: 1 })), '2021-01-11 13:05:09.000')
    assert.strictEqual(full(friday.set({ weekday: 7 })), '2021-01-17 13:05:09.000')

    inZone('America/Havana', () => {
      assert.strictEqual(full(at(2021, 2, 14, 12).startOf('week')), '2021-03-08 00:00:00.000')
      assert.strictEqual(full(at(2021, 2, 7, 12).endOf('week')), '2021-03-07 23:59:59.999')
    })
  })

  it('startOf and endOf stay on the same pass of a repeated hour', () => {
    const full = (date: IntlDate) => date.format('YYYY-MM-DD HH:mm:ss.SSS Z')
    inZone('America/New_York', () => {
      const firstPass = mockDate(new Date('2021-11-07T05:30:20.500Z'))
      const secondPass = mockDate(new Date('2021-11-07T06:30:20.500Z'))
      assert.strictEqual(full(firstPass.startOf('hour')), '2021-11-07 01:00:00.000 -04:00')
      assert.strictEqual(full(secondPass.startOf('hour')), '2021-11-07 01:00:00.000 -05:00')
      assert.strictEqual(full(secondPass.startOf('minute')), '2021-11-07 01:30:00.000 -05:00')
      assert.strictEqual(full(secondPass.startOf('second')), '2021-11-07 01:30:20.000 -05:00')
      assert.strictEqual(full(firstPass.endOf('hour')), '2021-11-07 01:59:59.999 -04:00')
      assert.strictEqual(full(secondPass.endOf('hour')), '2021-11-07 01:59:59.999 -05:00')
      assert.strictEqual(full(secondPass.endOf('minute')), '2021-11-07 01:30:59.999 -05:00')
      assert.strictEqual(full(secondPass.startOf('day')), '2021-11-07 00:00:00.000 -04:00')
    })
  })

  it('keeps years under 100', () => {
    const day = (date: IntlDate) => date.format('YYYY-MM-DD')
    assert.strictEqual(day(mockDate({ year: 50, month: 6, day: 15 })), '0050-06-15')
    assert.strictEqual(day(mockDate({ year: 0, month: 2, day: 29 })), '0000-02-29')
    assert.strictEqual(
      mockDate({ year: 50, month: 6, day: 15 }, { utc: true }).toISOString(),
      '0050-06-15T00:00:00.000Z'
    )

    const date = mockDate('0050-06-15T13:05:09')
    assert.strictEqual(day(date.startOf('month')), '0050-06-01')
    assert.strictEqual(day(date.endOf('month')), '0050-06-30')
    assert.strictEqual(day(date.set({ day: 1 })), '0050-06-01')
    assert.strictEqual(day(date.add({ days: 1 })), '0050-06-16')
    assert.strictEqual(day(mockDate({ year: 1950, month: 6, day: 15 })), '1950-06-15')
  })

  it('create from an Object without a month', () => {
    assert.strictEqual(mockDate({ year: 2020 }).format('YYYY-MM-DD'), '2020-01-01')
    assert.strictEqual(mockDate({ year: 2020, day: 5 }).format('YYYY-MM-DD'), '2020-01-05')
    assert.strictEqual(
      mockDate({ year: 2020 }, { utc: true }).toISOString(),
      '2020-01-01T00:00:00.000Z'
    )
  })

  it('diff counts whole calendar months, quarters and years', () => {
    const diff = (end: string, start: string, unit) => mockDate(end).diff(mockDate(start), unit)
    assert.strictEqual(diff('2021-03-01', '2021-02-01', 'months'), 1)
    assert.strictEqual(diff('2021-02-01', '2021-03-01', 'months'), -1)
    assert.strictEqual(diff('2021-12-31', '2021-01-01', 'months'), 11)
    assert.strictEqual(diff('2010-01-01', '2000-01-01', 'months'), 120)
    assert.strictEqual(diff('2021-02-28', '2021-01-31', 'months'), 1)
    assert.strictEqual(diff('2021-02-27', '2021-01-31', 'months'), 0)
    assert.strictEqual(diff('2021-01-31', '2021-02-28', 'months'), 0)
    assert.strictEqual(diff('2039-12-31', '2000-01-01', 'years'), 39)
    assert.strictEqual(diff('2040-01-01', '2000-01-01', 'years'), 40)
    assert.strictEqual(diff('2021-02-28', '2020-02-29', 'years'), 1)
    assert.strictEqual(diff('2021-07-01', '2021-01-01', 'quarters'), 2)
    assert.strictEqual(diff('2021-01-01', '2021-07-01', 'quarters'), -2)
    assert.strictEqual(diff('2021-03-31', '2021-01-01', 'quarters'), 0)
    assert.strictEqual(mockDate('2021-03-01').from('2021-02-01', 'months'), 'in 1 month')

    const start = mockDate('2021-01-31')
    assert.strictEqual(start.add({ months: 1 }).diff(start, 'months'), 1)
    assert(Number.isNaN(mockDate('garbage').diff(start, 'months')))
  })

  it('diff counts calendar days and weeks across DST', () => {
    inZone('America/New_York', () => {
      assert.strictEqual(at(2021, 2, 15).diff(at(2021, 2, 14), 'days'), 1)
      assert.strictEqual(at(2021, 2, 15).diff(at(2021, 2, 13), 'days'), 2)
      assert.strictEqual(at(2021, 2, 14).diff(at(2021, 2, 15), 'days'), -1)
      assert.strictEqual(at(2021, 10, 8).diff(at(2021, 10, 7), 'days'), 1)
      assert.strictEqual(at(2021, 2, 21).diff(at(2021, 2, 14), 'weeks'), 1)
      assert.strictEqual(at(2021, 2, 15).diff(at(2021, 2, 14), 'days', true), 1)
      assert.strictEqual(at(2021, 2, 15).diff(at(2021, 2, 14), 'hours'), 23)

      const start = at(2021, 2, 14)
      assert.strictEqual(start.add({ days: 1 }).diff(start, 'days'), 1)
    })
  })

  it('toISODate and toISOTime split an expanded year', () => {
    assert.strictEqual(mockDate(new Date(8.64e15)).toISODate(), '+275760-09-13')
    assert.strictEqual(mockDate(new Date(8.64e15)).toISOTime(), '00:00:00.000Z')
    assert.strictEqual(mockDate(new Date(-8.64e15)).toISODate(), '-271821-04-20')
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
it('strftime %-H accepts a timestamp and no date', () => {
  assert(strftime('%-H', Date.UTC(2020, 0, 1, 9)) === '9')
  assert(/^\d+$/.test(strftime('%-H', undefined as any)))

  assert(strftime('%-H', null as any) === '0')
})

describe('date utilities', () => {
  it('minDate and maxDate do not stop at an invalid first date', () => {
    const early = new Date(0)
    const late = new Date(5)
    const invalid = new Date(NaN)
    assert.strictEqual(minDate([invalid, late, early]), early)
    assert.strictEqual(maxDate([invalid, early, late]), late)
    assert.strictEqual(minDate([late, invalid, early]), early)
    assert.strictEqual(maxDate([early, invalid, late]), late)
    assert.strictEqual(IntlDate.min(mockDate('garbage'), late), late)
    assert.strictEqual(minDate([invalid]), invalid)
  })

  it('dayOfYear and week keep years under 100', () => {
    assert.strictEqual(dayOfYear('0050-06-15'), 166)
    assert.strictEqual(dayOfYear('0004-12-31'), 366)
    assert.strictEqual(mockDate('0050-06-15').dayOfYear(), 166)
    assert.strictEqual(mockDate('0050-06-15').isoWeek(), 24)
  })

  it('read a date string as local time', () => {
    inZone('America/New_York', () => {
      assert.strictEqual(daysInMonth('2021-03-01'), 31)
      assert.strictEqual(daysInMonth('2021-02-01'), 28)
      assert.strictEqual(dayOfYear('2021-01-01'), 1)
      assert.strictEqual(dayOfYear('2021-12-31'), 365)
      assert.deepStrictEqual(weekOfYear('2021-01-04', 1, 4), { week: 1, year: 2021 })
      assert.strictEqual(
        addDuration('2021-03-01', { months: 1 }).toISOString(),
        '2021-04-01T04:00:00.000Z'
      )
    })
  })
})

describe('Duration', () => {
  it('toISOString counts quarters as months', () => {
    assert.strictEqual(new Duration({ quarters: 1 }).toISOString(), 'P3M')
    assert.strictEqual(new Duration({ years: 1, quarters: 1, months: 1 }).toISOString(), 'P1Y4M')
  })

  it('reads its getters whatever it was built from', () => {
    assert.strictEqual(new Duration(NaN).years, 0)
    assert.strictEqual(new Duration(NaN).toISOString(), 'PT0S')
    assert.strictEqual(new Duration(null).hours, 0)
    assert(Number.isNaN(new Duration(NaN).total('days')))
    assert(Number.isNaN(new Duration(NaN).total('milliseconds')))
  })

  it('exact durations stay exact', () => {
    const exact = new Duration({ months: 1 }, true)
    assert.strictEqual(new Duration(exact).total('days'), 30.436875)
    assert.strictEqual(exact.negated().total('days'), -30.436875)
    assert.strictEqual(exact.abs().total('days'), 30.436875)
    assert.strictEqual(exact.add({ days: 1 }).total('days'), 31.436875)
    assert.strictEqual(exact.subtract({ days: 1 }).total('days'), 29.436875)
    assert.strictEqual(exact.normalize().total('days'), 30.436875)
    assert.strictEqual(new Duration({ days: 365 }, true).rescale().get('years'), 0)
    assert.strictEqual(new Duration({ months: 1 }).abs().total('days'), 30)
  })

  it('exact with a unit leaves the receiver alone', () => {
    const duration = new Duration({ months: 1 })
    assert.strictEqual(duration.exact('days'), 30.436875)
    assert.strictEqual(duration.total('days'), 30)
  })

  it('normalize and rescale leave the receiver alone', () => {
    const duration = new Duration({ hours: 1, minutes: 90 })
    assert.deepStrictEqual(duration.normalize().toObject(), { hours: 2, minutes: 30 })
    assert.deepStrictEqual(duration.toObject(), { hours: 1, minutes: 90 })
    assert.deepStrictEqual(duration.rescale().toObject(), { hours: 2, minutes: 30 })
    assert.deepStrictEqual(duration.toObject(), { hours: 1, minutes: 90 })
  })

  it('reads quarters like any other unit', () => {
    assert.strictEqual(new Duration({ quarters: 2 }).get('quarters'), 2)
    assert.strictEqual(new Duration({ quarter: 2 }).get('quarter'), 2)
    assert.strictEqual(new Duration({ hours: 1 }).get('quarters'), 0)
    assert.strictEqual(new Duration({ years: 1 }).total('quarters'), 4)
    assert.strictEqual(new Duration({ months: 3 }).total('quarters'), 1)

    const sum = new Duration({ quarters: 1 }).add({ quarters: 1 })
    assert.deepStrictEqual(sum.toObject(), { quarters: 2 })
    const difference = new Duration({ quarters: 2 }).subtract({ quarters: 1 })
    assert.deepStrictEqual(difference.toObject(), { quarters: 1 })

    const start = mockDate('2021-01-01')
    assert.strictEqual(mockDate('2021-12-01').from(start, 'quarters'), 'in 3 quarters')
    assert.strictEqual(mockDate('2021-12-01').to(start, 'quarter'), '3 quarters ago')
    assert.strictEqual(mockDate('2021-12-01').diff(start, 'quarters'), 3)
  })

  it('fromISO keeps only the units in the text', () => {
    assert.deepStrictEqual(Duration.fromISO('PT23H').toObject(), { hours: 23 })
    assert.deepStrictEqual(Duration.fromISO('P5Y3M').toObject(), { years: 5, months: 3 })
    assert.deepStrictEqual(Duration.fromISO('PT1H').negated().toObject(), { hours: -1 })
    assert.deepStrictEqual(Duration.fromISO('-PT1H').abs().toObject(), { hours: 1 })
    assert.strictEqual(Duration.fromISO('PT1H').total('minutes'), 60)
    assert.strictEqual(Duration.fromISO('P1D').total('hours'), 24)
    assert.deepStrictEqual(Duration.fromISO('PT90M').rescale().toObject(), {
      hours: 1,
      minutes: 30
    })

    const date = new Date(Date.UTC(2021, 0, 15, 12))
    const later = addDuration(date, Duration.fromISO('PT1H'))
    const earlier = subDuration(date, Duration.fromISO('PT1H'))
    assert.strictEqual(later.toISOString(), '2021-01-15T13:00:00.000Z')
    assert.strictEqual(earlier.toISOString(), '2021-01-15T11:00:00.000Z')
    assert.deepStrictEqual(new Duration({ hours: undefined, minutes: 5 }).toObject(), {
      minutes: 5
    })
  })
  it('IntlDate reads a year given as a string', () => {
    assert(new IntlDate({ year: '2024', month: 3, day: 1 } as any).year === 2024)
  })
})
