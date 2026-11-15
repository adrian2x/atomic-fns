# atomic-fns

A utility library with no runtime dependencies that fills the gaps the platform leaves: collection helpers and data structures, object paths, deep equality and cloning, exact decimal arithmetic, array operations, function and async helpers, strings, numbers, ids, hashing and encoding.

Install from npm with `npm install atomic-fns`, or from JSR with `deno add jsr:@atomic-stack/atomic-fns`.

## Import

```ts
import { Decimal, keys, Heap } from 'atomic-fns'
import { SortedMap } from 'atomic-fns/collections'
```

Every export is available from the root and its area subpath. [docs/design.md](https://github.com/adrian2x/atomic-fns/blob/main/docs/design.md) describes the API and its rules.

Supports Node `^24.22.3 || >=26.13.1`, Deno, Bun, browsers at Baseline and workers. Published types support TypeScript 6.0 and later.

The 1.x line lives on the [`1.x` branch](https://github.com/adrian2x/atomic-fns/tree/1.x).

`sample` and `sampleSize` draw from arrays and typed arrays by reading only selected positions unless an array hole triggers a full scan, but `sampleSize` copies all values for full samples and when `n >= 5 && n >= length / 2`; sparse arrays may consume extra draws, so seeded results can differ from sampling their collected values, and `sampleSize(xs, 0)` reads no values.

## Decimal

Exact decimal arithmetic shaped after the TC39 Decimal draft, with Currency.

```ts
import { Currency, Decimal } from 'atomic-fns/decimal'
```

No runtime dependencies, no Node APIs: it runs on the platforms listed above.

### Decimal

A `Decimal` is an immutable exact decimal number. Methods replace operators, so nothing rounds through a binary `Number`.

```ts
const a = new Decimal('0.1')
a.add('0.2').toString() // '0.3'
a.add('0.2').equals('0.3') // true
new Decimal('19.99').multiply(3).toString() // '59.97'
new Decimal('7.5').remainder(2).toString() // '1.5'
```

The constructor and every operand take a `Decimal`, a decimal string (`'-1.5'`, `'.5'`, `'2e-3'`), a bigint, or a finite number, which enters through its shortest round-trip string (`new Decimal(0.1)` is exactly `0.1`). A malformed string or a non-finite number throws `RangeError`; any other type throws `TypeError`.

#### Rounding

`divide` and `sqrt` round to `precision` significant digits (default 34, as the TC39 draft does), while `round` and `toFixed` take fractional `digits`. Each takes one of the `Intl.NumberFormat` rounding modes: `ceil`, `floor`, `expand`, `trunc`, `halfCeil`, `halfFloor`, `halfExpand`, `halfTrunc` and `halfEven` (the default, except for `toFixed`, which defaults to `halfExpand`).

```ts
new Decimal(1).divide(3).toString() // '0.3333333333333333333333333333333333'
new Decimal('1e-30').divide(3, { precision: 3 }).toString() // '0.000000000000000000000000000000333'
new Decimal(2).divide(3, { precision: 2, roundingMode: 'trunc' }).toString() // '0.66'
new Decimal('2.5').round().toString() // '2'
new Decimal('2.5').round(0, 'halfExpand').toString() // '3'
new Decimal('1234').round(-2).toString() // '1200'
new Decimal(2).sqrt({ precision: 5 }).toString() // '1.4142'
```

Dividing by zero throws `RangeError`, and so does a quotient too small for the exponent bound.

#### Comparing

`compare` returns -1, 0 or 1, `equals` ignores the written form, and `lessThan`, `lessThanOrEqual`, `greaterThan` and `greaterThanOrEqual` answer the rest. `Decimal.compare` sorts:

```ts
;['10', '9', '9.5']
  .map((s) => new Decimal(s))
  .toSorted(Decimal.compare)
  .map(String)
// ['9', '9.5', '10']
```

`valueOf` throws, so `<`, `+` and `==` cannot silently compare or add a Decimal as a `Number`. Between two Decimals, `==` and `===` compare identity, so use `equals`. Template literals and `String()` still work. In Node, Deno and Bun, `console.log` shows `Decimal { 1.5 }`, through the runtime's `Symbol.for('nodejs.util.inspect.custom')` hook.

#### Converting

```ts
new Decimal('1.50').toString() // '1.5'
new Decimal('1e100').toString() // '1e+100'
new Decimal('1e5').toPlainString() // '100000'
new Decimal('1.005').toFixed(2) // '1.01'
new Decimal('1234.5678').toLocaleString('de-DE') // '1.234,568'
new Decimal('0.1').toNumber() // 0.1
new Decimal('1.2e3').toBigInt() // 1200n
JSON.stringify({ price: new Decimal('9.90') }) // '{"price":"9.9"}'
```

`toString` and `toJSON` switch to scientific form once plain notation would pad more than 64 zeros; `toPlainString` always expands. A short input such as `'1e10000'` becomes 10,001 characters, so prefer `toString` for untrusted values. `toFixed` rounds ties half away from zero, as `Number.prototype.toFixed` does, unless given a rounding mode.

#### Bounds

A Decimal holds at most `Decimal.MAX_DIGITS` (10,000) significant digits, and the exponent of its integer coefficient lies within `Decimal.MAX_EXPONENT` (10,000) either way: `'1.5e-10000'`, stored as 15e-10001, is out of range. `divide` and `sqrt` take a `precision` up to `Decimal.MAX_DIGITS`, and `round` and `toFixed` take `digits` up to `Decimal.MAX_PRECISION` (10,000). Inputs and results past a bound throw `RangeError`, and so do strings longer than 30,032 characters, so a short untrusted string such as `'1e1000000000'` cannot allocate without limit and parse cost is bounded. Each operation still costs time that grows with its operands' digits, so size-limit untrusted lists before summing them.

### Currency

A `Currency` is an exact `amount` (a `Decimal`) and a `currency` code. The code must be three ASCII letters, as ISO 4217 codes are, but the constructor does not check it against the ISO 4217 list.

```ts
const price = new Currency('19.99', 'usd')
price.currency // 'USD'
price.multiply(3).format('en-US') // '$59.97'
price.add(new Currency('0.01', 'USD')).toString() // '20 USD'
new Currency(10, 'USD').divide(3).round().toString() // '3.33 USD'
new Currency('1234.5', 'JPY').round().toString() // '1234 JPY'
```

`add`, `subtract`, `compare` and the relational methods take another `Currency` and throw `RangeError` when the codes differ; `equals` answers false. `multiply` and `divide` take a plain factor. `round()` rounds to the currency's ISO 4217 minor unit, half to even, not to the digits `Intl` displays, and throws `RangeError` for a code that ISO 4217 gives no minor unit, such as `XAU`, or does not list; `round(digits)` takes any code.

`format(locale, options)`, also `toLocaleString`, formats with `Intl.NumberFormat` in currency style. Unless the options set `maximumFractionDigits`, a significant-digit option, `roundingIncrement` or a non-standard `notation`, the amount keeps its own fraction digits, up to 20:

```ts
new Currency('0.125', 'USD').format('en-US') // '$0.125'
new Currency('0.125', 'USD').format('en-US', { maximumFractionDigits: 2 }) // '$0.13'
new Currency(-5, 'USD').format('en-US', { currencySign: 'accounting' }) // '($5.00)'
new Currency(5, 'USD').format('en-US', { currencyDisplay: 'name' }) // '5.00 US dollars'
```

`toString` and `toJSON` give `'12.5 USD'`, and in Node, Deno and Bun `console.log` shows `Currency { 12.5 USD }`. Like `Decimal`, `valueOf` throws.

## Development

```sh
npm install
npm run check
```

`check` runs Biome, the type check, the tests, the build, and a JSR dry run.

## License

[Apache License 2.0](https://github.com/adrian2x/atomic-fns/blob/main/LICENSE)
