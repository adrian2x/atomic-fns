/**
 * Active ISO 4217 codes by minor-unit digits, from the ISO 4217 list one published 2026-09-17.
 * Codes the list gives no minor unit (XAU, XDR, XXX and the other funds and metals) are absent.
 * `Intl` cannot stand in: it reports CLDR display digits, which differ from ISO 4217 (0 for IQD
 * and HUF) and change with the runtime's ICU version.
 */
const CODES_BY_MINOR_UNITS: readonly (readonly [number, string])[] = [
  [0, 'BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF'],
  [
    2,
    'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BMD BND BOB BOV BRL BSD BTN BWP BYN ' +
      'BZD CAD CDF CHE CHF CHW CNY COP COU CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR FJD ' +
      'FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD KES KGS KHR KPW ' +
      'KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR ' +
      'MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB SAR SBD SCR SDG ' +
      'SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP TRY TTD TWD TZS UAH USD ' +
      'USN UYU UZS VED VES WST XAD XCD XCG YER ZAR ZMW ZWG'
  ],
  [3, 'BHD IQD JOD KWD LYD OMR TND'],
  [4, 'CLF UYW']
]

let minorUnits: Map<string, number> | undefined

/** The ISO 4217 minor-unit digits of an upper-case `code`, or undefined when it has none. */
export function isoMinorUnits(code: string): number | undefined {
  if (minorUnits === undefined) {
    minorUnits = new Map()
    for (const [digits, codes] of CODES_BY_MINOR_UNITS) {
      for (const listed of codes.split(' ')) minorUnits.set(listed, digits)
    }
  }
  return minorUnits.get(code)
}
