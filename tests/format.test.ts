import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { daysInMonth, IntlDate } from '../src/i18n/date/index.js'
import { asDate, formatDate, strftime } from '../src/i18n/format.js'

describe('SPEC-R85 formatDate America/New_York', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('SPEC-R85 midnight tokens and Sunday d print zero', () => {
    const d = new Date(2020, 0, 5, 0, 0, 0)
    expect(d.getDay()).toBe(0)
    expect(formatDate('H:m:s', d)).toBe('0:0:0')
    expect(formatDate('d', d)).toBe('0')
    expect(formatDate('HH:mm:ss', d)).toBe('00:00:00')
  })

  it('SPEC-R85 Z/ZZ sign is local minus UTC', () => {
    const d = new Date(2020, 0, 1, 0, 0, 0)
    expect(formatDate('Z', d)).toBe('-05:00')
    expect(formatDate('ZZ', d)).toBe('-0500')
  })

  it('SPEC-R85 unknown letter runs stay literal', () => {
    const d = new Date(2020, 0, 1, 0, 0, 0)
    expect(formatDate('foo YYYY brr', d)).toBe('foo 2020 brr')
    expect(formatDate('Y', d)).toBe('Y')
  })

  it('SPEC-R85 default format is ISO 8601', () => {
    const d = new Date(2020, 0, 1, 0, 0, 0)
    expect(formatDate('', d)).toBe('2020-01-01T00:00:00-05:00')
  })

  it('SPEC-R85 invalid Date returns Invalid Date', () => {
    expect(formatDate('YYYY', new Date(NaN))).toBe('Invalid Date')
  })

  it('SPEC-R85 k kk E tokens', () => {
    const midnight = new Date(2020, 0, 1, 0, 0, 0)
    expect(formatDate('k', midnight)).toBe('24')
    expect(formatDate('kk', midnight)).toBe('24')
    const sat = new Date(2020, 1, 1, 12, 0, 0)
    expect(formatDate('E', sat)).toBe('6')
  })
})

describe('SPEC-R85 formatDate Asia/Kolkata', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('SPEC-R85 Z offset positive half-hour', () => {
    const d = new Date(2020, 0, 1, 0, 0, 0)
    expect(formatDate('Z', d)).toBe('+05:30')
    expect(formatDate('ZZ', d)).toBe('+0530')
  })
})

describe('SPEC-R85 formatDate era locales', () => {
  it.each(['en', 'ja', 'ko', 'zh', 'ar'] as const)(
    'SPEC-R85 NNNN era has no year digits (%s)',
    (locale) => {
      const d = new Date(2020, 1, 1)
      const era = formatDate('NNNN', d, locale)
      expect(era).not.toMatch(/\d/)
      expect(era.length).toBeGreaterThan(0)
    }
  )
})

describe('SPEC-R85 formatDate localized tokens', () => {
  it('covers former date.test format cases under en-US', () => {
    const date = new Date(2020, 1, 1, 11, 1, 1, 1)
    const locale = 'en-US'
    expect(formatDate('YYYY MMMM DD', date, locale)).toBe('2020 February 01')
    expect(formatDate('YYYY MMMM DD dddd', date, locale)).toBe('2020 February 01 Saturday')
    expect(formatDate('ddd, MMM DD, YYYY', date, locale)).toBe('Sat, Feb 01, 2020')
    expect(formatDate('ddd, MMM DD, YYYY NN', date, locale)).toBe('Sat, Feb 01, 2020 AD')
    expect(formatDate('ddd, MMM DD, YYYY NNNN', date, locale)).toBe('Sat, Feb 01, 2020 Anno Domini')
    expect(formatDate('hh:mm:ss', date, locale)).toMatch(/\d{2}:\d{2}:\d{2}$/)
    expect(formatDate('HH:mm:ss', date, locale)).toMatch(/\d{2}:\d{2}:\d{2}$/)
    expect(formatDate('hh:mm:ss A', date, locale)).toMatch(/\sPM|AM/)
    expect(formatDate('h:m:s a', date, locale)).toMatch(/\spm|am/)
    expect(formatDate('h:m:s', date, locale)).toMatch(/\d+:\d+:\d+$/)
    expect(formatDate('LT', date, locale)).toMatch(/\d+:\d+\sPM|AM/)
    expect(formatDate('LTS', date, locale)).toMatch(/\d+:\d+:\d+\sPM|AM/)
    expect(formatDate('L', date, locale)).toBe('02/01/2020')
    expect(formatDate('LL', date, locale)).toBe('February 1, 2020')
    expect(formatDate('LLL', date, locale)).toContain('February 1, 2020')
    expect(formatDate('LLL', date, locale)).toMatch(/\d+:\d+\sPM|AM/)
    expect(formatDate('LLLL', date, locale)).toContain('Saturday, February 1, 2020')
    expect(formatDate('LLLL', date, locale)).toMatch(/\d+:\d+\sPM|AM/)
    expect(formatDate('l', date, locale)).toBe('2/1/2020')
    expect(formatDate('ll', date, locale)).toBe('Feb 1, 2020')
    expect(formatDate('lll', date, locale)).toContain('Feb 1, 2020')
    expect(formatDate('lll', date, locale)).toMatch(/\d+:\d+\sPM|AM/)
    expect(formatDate('llll', date, locale)).toContain('Sat, Feb 1, 2020')
    expect(formatDate('llll', date, locale)).toMatch(/\d+:\d+\sPM|AM/)
  })

  it('SPEC-R85 bracketed literals', () => {
    const d = new Date(2020, 1, 1)
    expect(formatDate('[Year:] YYYY', d)).toBe('Year: 2020')
  })

  it('SPEC-R85 Do renders English ordinal suffixes', () => {
    const expected: Record<number, string> = {
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
      31: '31st'
    }
    for (const [day, ordinal] of Object.entries(expected)) {
      expect(formatDate('Do', new Date(2022, 0, Number(day)), 'en')).toBe(ordinal)
    }
    expect(formatDate('Do MMMM YYYY', new Date(2022, 9, 1), { locale: 'en' })).toBe(
      '1st October 2022'
    )
  })

  it('SPEC-R85 Do does not append an English suffix for other languages', () => {
    expect(formatDate('Do', new Date(2022, 0, 1), 'de')).toBe('1')
    expect(formatDate('[Do] D', new Date(2022, 0, 2), 'en')).toBe('Do 2')
  })

  it('Do token computed once per formatDate call (5000 under 50ms)', () => {
    const d = new Date(2024, 0, 2)
    const pattern = 'Do'.repeat(5000)
    const start = performance.now()
    const out = formatDate(pattern, d, 'en')
    expect(performance.now() - start).toBeLessThan(50)
    expect(out).toBe('2nd'.repeat(5000))
  })
})

describe('SPEC-R85 formatDate and strftime UTC view America/New_York', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  const instant = new Date('2022-01-05T13:07:09Z')

  it('SPEC-R85 utc reads UTC fields and zero offset', () => {
    expect(formatDate('YYYY-MM-DD HH:mm:ss', instant, { utc: true })).toBe('2022-01-05 13:07:09')
    expect(formatDate('Z', instant, { utc: true })).toBe('+00:00')
    expect(formatDate('ZZ', instant, { utc: true })).toBe('+0000')
    expect(formatDate('z', instant, { utc: true })).toBe('UTC')
    expect(formatDate('', instant, { utc: true })).toBe('2022-01-05T13:07:09+00:00')
  })

  it('SPEC-R85 without utc the local view is unchanged', () => {
    expect(formatDate('HH:mm Z', instant)).toBe('08:07 -05:00')
    expect(formatDate('HH:mm Z', instant, { utc: false })).toBe('08:07 -05:00')
  })

  it('SPEC-R85 utc X and x come from the true instant', () => {
    expect(formatDate('X', instant, { utc: true })).toBe(String(instant.getTime() / 1000))
    expect(formatDate('x', instant, { utc: true })).toBe(String(instant.getTime()))
    expect(formatDate('X', instant)).toBe(formatDate('X', instant, { utc: true }))
  })

  it('SPEC-R85 utc wall times inside a local DST gap are not shifted', () => {
    const gap = new Date('2024-03-10T02:30:00Z')
    expect(formatDate('HH:mm', gap, { utc: true })).toBe('02:30')
    expect(formatDate('HH:mm', gap)).toBe('21:30')
  })

  it('SPEC-R85 utc applies to Intl backed tokens', () => {
    const lateUtc = new Date('2022-01-01T02:00:00Z')
    expect(formatDate('D MMM', lateUtc, { locale: 'en', utc: true })).toBe('1 Jan')
    expect(formatDate('D MMM', lateUtc, { locale: 'en' })).toBe('31 Dec')
    expect(formatDate('ll', lateUtc, { locale: 'en', utc: true })).toBe('Jan 1, 2022')
    expect(formatDate('zzz', lateUtc, { locale: 'en', utc: true })).toBe(
      'Coordinated Universal Time'
    )
  })

  it('SPEC-R86 strftime utc reads UTC fields', () => {
    expect(strftime('%Y-%m-%d %H:%M:%S %z %Z', instant, { utc: true })).toBe(
      '2022-01-05 13:07:09 +0000 UTC'
    )
    expect(strftime('%H:%M %z', instant)).toBe('08:07 -0500')
    expect(strftime('%A %d', new Date('2022-01-01T02:00:00Z'), { locale: 'en', utc: true })).toBe(
      'Saturday 01'
    )
  })
})

describe('SPEC-R86 strftime', () => {
  it('SPEC-R86 %Y is 4 digits and %y is 2', () => {
    const d = new Date(2020, 1, 1, 11, 1, 1, 1)
    expect(strftime('%Y', d)).toBe('2020')
    expect(strftime('%y', d)).toBe('20')
  })

  it('SPEC-R86 %p uppercase %P lowercase independent of hour directives', () => {
    const pm = new Date(2020, 1, 1, 15, 0, 0)
    const am = new Date(2020, 1, 1, 9, 0, 0)
    expect(strftime('%p', pm)).toBe('PM')
    expect(strftime('%P', pm)).toBe('pm')
    expect(strftime('%p', am)).toBe('AM')
    expect(strftime('%P', am)).toBe('am')
    expect(strftime('%H %p', pm)).toBe('15 PM')
  })

  it('SPEC-R86 unknown directive and trailing % stay literal; no trim', () => {
    const d = new Date(2020, 1, 1)
    expect(strftime('%Q', d)).toBe('%Q')
    expect(strftime('%', d)).toBe('%')
    expect(strftime('  %d  ', d)).toBe('  01  ')
  })

  it('covers former date.test strftime cases under 2.0 semantics', () => {
    const date = new Date(2020, 1, 1, 11, 1, 1, 1)
    const locale = 'en-US'
    expect(strftime('%A', date, locale)).toBe('Saturday')
    expect(strftime('%a', date, locale)).toBe('Sat')
    expect(strftime('%d', date, locale)).toBe('01')
    expect(strftime('%-d', date, locale)).toBe('1')
    expect(strftime('%m', date, locale)).toBe('02')
    expect(strftime('%-m', date, locale)).toBe('2')
    expect(strftime('%B', date, locale)).toBe('February')
    expect(strftime('%b', date, locale)).toBe('Feb')
    expect(strftime('%bb', date, locale)).toBe('2')
    expect(strftime('%N', date, locale)).toBe('Anno Domini')
    expect(strftime('%n', date, locale)).toBe('AD')
    expect(strftime('%I', date, locale)).toMatch(/\d{2}/)
    expect(strftime('%-I', date, locale)).toMatch(/\d+/)
    expect(strftime('%H', date, locale)).toMatch(/\d{2}/)
    expect(strftime('%-H', date, locale)).toMatch(/\d+/)
    expect(strftime('%K', date, locale)).toMatch(/\d{2}/)
    expect(strftime('%k', date, locale)).toMatch(/\d{2}/)
    expect(strftime('%M', date, locale)).toBe('01')
    expect(strftime('%-M', date, locale)).toBe('1')
    expect(strftime('%S', date, locale)).toBe('01')
    expect(strftime('%-S', date, locale)).toBe('1')
    expect(strftime('%A, %d/%m/%Y', date, locale)).toBe('Saturday, 01/02/2020')
    expect(strftime('%Y-%m-%d, %A', date, locale)).toBe('2020-02-01, Saturday')
    expect(strftime('%Y %B %d %A', date, locale)).toBe('2020 February 01 Saturday')
    expect(strftime('%a, %b %d, %Y %n', date, locale)).toBe('Sat, Feb 01, 2020 AD')
    expect(strftime('%a, %b %d, %Y %N', date, locale)).toBe('Sat, Feb 01, 2020 Anno Domini')
    expect(strftime('%I:%M:%S', date, locale)).toMatch(/\d{2}:\d{2}:\d{2}$/)
    expect(strftime('%I:%M:%S %p', date, locale)).toMatch(/\d{2}:\d{2}:\d{2}\s*AM|PM$/)
    expect(strftime('%-I:%-M:%-S %P', date, locale)).toMatch(/\d+:\d+:\d+\s*am|pm$/)
    expect(strftime('%H:%M:%S', date, locale)).toMatch(/\d{2}:\d{2}:\d{2}$/)
    expect(strftime('%-H:%-M:%-S', date, locale)).toMatch(/\d+:\d+:\d+$/)
    expect(strftime('%K:%M:%S %p', date, locale)).toMatch(/\d+:\d+:\d+\s*AM|PM$/)
    expect(strftime('%k:%-M:%-S %P', date, locale)).toMatch(/\d+:\d+:\d+\s*am|pm$/)
  })
})

describe('SPEC-R85 tokenizer', () => {
  const prev = process.env.TZ
  let d: Date

  beforeAll(() => {
    process.env.TZ = 'America/New_York'
    d = new Date(2024, 0, 5, 0, 7, 9, 45)
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('SPEC-R85 unknown runs stay literal as a whole', () => {
    expect(formatDate('Y', d)).toBe('Y')
    expect(formatDate('YYY', d)).toBe('YYY')
    expect(formatDate('YYYYY', d)).toBe('YYYYY')
    expect(formatDate('dd', d)).toBe('dd')
    expect(formatDate('S', d)).toBe('S')
    expect(formatDate('SS', d)).toBe('SS')
    expect(formatDate('SSSS', d)).toBe('SSSS')
    expect(formatDate('SSS', d)).toBe('045')
    expect(formatDate('DDo', d)).toBe('05o')
    expect(formatDate('LLT', d)).toBe(formatDate('LL', d) + 'T')
  })

  it('SPEC-R85 year padding for YYYY YY %Y %y', () => {
    const d50 = new Date(0)
    d50.setFullYear(50, 2, 1)
    expect(formatDate('YYYY-MM-DD', d50)).toBe('0050-03-01')

    const d5 = new Date(0)
    d5.setFullYear(5, 0, 1)
    expect(formatDate('YY', d5)).toBe('05')

    const dNeg = new Date(0)
    dNeg.setFullYear(-1, 0, 1)
    expect(formatDate('YYYY', dNeg)).toBe('-0001')

    const year7 = new Date(0)
    year7.setFullYear(7, 0, 1)
    expect(strftime('%y', year7)).toBe('07')
    expect(strftime('%Y', year7)).toBe('0007')

    expect(
      new IntlDate(new Date(0))
        .set({ year: 99, month: 12, day: 31 })
        .add({ days: 61 })
        .format('YYYY-MM-DD')
    ).toBe('0100-03-02')
  })

  it('SPEC-R85 brackets literal and unclosed', () => {
    expect(formatDate('[YYYY]', d)).toBe('YYYY')
    expect(formatDate('[YYYY', d)).toBe('[2024')
    expect(formatDate('[]', d)).toBe('')
    expect(formatDate('[a[b]', d)).toBe('a[b')
    expect(formatDate('[[YYYY]]', d)).toBe('[YYYY]')
  })

  it('SPEC-R86 strftime %% flag and %bb', () => {
    expect(strftime('%%Y', d)).toBe('%Y')
    expect(strftime('%-', d)).toBe('%-')
    expect(strftime('%-Q', d)).toBe('%-Q')
    expect(strftime('%bb', d)).toBe('1')
    expect(strftime('%b%b', d)).toBe('JanJan')
  })

  it('SPEC-R85 prototype-named letter runs do not throw', () => {
    const out = formatDate('constructor toString __proto__', d)
    expect(out).toContain('__proto__')
  })

  it('SPEC-R85 formatter cache is capacity 64 LRU', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat')
    try {
      formatDate('MMM', d, 'en-x-k0')
      for (let i = 1; i <= 64; i++) {
        formatDate('MMM', d, 'en-x-k' + String(i))
      }
      formatDate('MMM', d, 'en-x-k0')
      expect(spy.mock.calls.filter((c) => c[0] === 'en-x-k0')).toHaveLength(2)

      spy.mockClear()
      formatDate('MMM', d, 'en-x-k1')
      formatDate('MMM', d, 'en-x-k1')
      expect(spy.mock.calls.filter((c) => c[0] === 'en-x-k1')).toHaveLength(1)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('SPEC-R87 asDate', () => {
  it('SPEC-R87 fractional seconds right-pad to milliseconds', () => {
    expect(asDate('2020-01-01T00:00:00.5').getMilliseconds()).toBe(500)
    expect(asDate('2020-01-01T00:00:00.56').getMilliseconds()).toBe(560)
    expect(asDate('2020-01-01T00:00:00.5678').getMilliseconds()).toBe(567)
  })

  it('SPEC-R87 month-end UTC input does not overflow', () => {
    const d = asDate('2020-01-31T12:00:00', true)
    expect(d.getUTCFullYear()).toBe(2020)
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(31)
  })

  it('SPEC-R87 null is invalid; undefined is now', () => {
    expect(Number.isNaN(asDate(null).getTime())).toBe(true)
    const before = Date.now()
    const d = asDate(undefined)
    const after = Date.now()
    expect(d.getTime()).toBeGreaterThanOrEqual(before)
    expect(d.getTime()).toBeLessThanOrEqual(after)
  })
})

describe('asDate grammar', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('literal small years', () => {
    expect(new IntlDate('0050-03-01').year).toBe(50)
    expect(new IntlDate('0000-02-15').year).toBe(0)
    expect(daysInMonth('0000-02-15')).toBe(29)
    expect(asDate('0099-12-31T00:00:00Z').getUTCFullYear()).toBe(99)
  })

  it('overflow is invalid', () => {
    for (const s of [
      '2021-02-30',
      '2021-13-01',
      '2021-01-01T25:61',
      '2021-02-29',
      '2021-01-01T12:60',
      '2021-01-01T12:00:60',
      '2021-01-01T24:01'
    ]) {
      expect(Number.isNaN(asDate(s).getTime())).toBe(true)
    }
    expect(asDate('2020-02-29').getDate()).toBe(29)
  })

  it('hour 24 rolls to next day', () => {
    const d = asDate('2021-01-31T24:00')
    expect(d.getDate()).toBe(1)
    expect(d.getMonth()).toBe(1)
  })

  it('offsets and separators', () => {
    expect(asDate('2021-06-01T12:00:00+05:30').getTime()).toBe(Date.UTC(2021, 5, 1, 6, 30))
    expect(asDate('2021-06-01T12:00:00-0130').getTime()).toBe(Date.UTC(2021, 5, 1, 13, 30))
    expect(asDate('2021-06-01T12:00:00+05').getTime()).toBe(Date.UTC(2021, 5, 1, 7))
    expect(asDate('2021-06-01t12:00:00z').getTime()).toBe(Date.UTC(2021, 5, 1, 12))
    const local = asDate('2021-06-01 12:00')
    expect(local.getFullYear()).toBe(2021)
    expect(local.getMonth()).toBe(5)
    expect(local.getDate()).toBe(1)
    expect(local.getHours()).toBe(12)
    expect(local.getMinutes()).toBe(0)
  })

  it('comma fraction and 10-digit fraction invalid', () => {
    expect(asDate('2020-01-01T00:00:00,25').getMilliseconds()).toBe(250)
    expect(Number.isNaN(asDate('2020-01-01T00:00:00.1234567890').getTime())).toBe(true)
  })

  it('expanded years', () => {
    expect(asDate('+010000-01-01T00:00:00Z').getUTCFullYear()).toBe(10000)
    expect(asDate('-000001-01-01T00:00:00Z').getUTCFullYear()).toBe(-1)
    expect(Number.isNaN(asDate('-000000-01-01').getTime())).toBe(true)
  })

  it('local date-only', () => {
    expect(asDate('2021').getTime()).toBe(new Date(2021, 0, 1).getTime())
    expect(asDate('2021-03').getDate()).toBe(1)
  })

  it('DST gap resolves forward', () => {
    const d = asDate('2021-03-14T02:30')
    expect(d.getHours()).toBe(3)
    expect(d.getMinutes()).toBe(30)
  })

  it('fallback and committed invalid', () => {
    expect(asDate('March 7, 2020').getFullYear()).toBe(2020)
    expect(Number.isNaN(asDate('x'.repeat(129)).getTime())).toBe(true)
    expect(Number.isNaN(asDate('2021-01-01junk').getTime())).toBe(true)
  })
})
