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

## Collections

Sorted maps and sets, trees, heap, deque, LRU cache, trie, frozen set and bisect: the data structures the platform does not ship. No dependencies, no Node APIs.

### Conventions

- Classes use `Map` and `Set` method names where the concept matches: `get`, `set`, `has`, `delete`, `clear`, `size`, `keys`, `values`, `entries`, `forEach(callback(value, key, collection))` and `[Symbol.iterator]`. `Deque` follows Array's names instead: `push`, `pop`, `shift`, `unshift`, `at`, `set(index, value)` and `includes`.
- Sorted structures and the bisect functions take an optional comparator `(a, b) => number`. The default orders numbers and bigints by value (compared exactly with each other) and strings by UTF-16 code units, as `<` does. `NaN` throws `RangeError`; mixed strings and numbers, `null`, `undefined` and every other value throw `TypeError` asking for a comparator. Keys the comparator calls equal are the same key.
- `Heap`, `Deque` and `FrozenSet` membership is SameValueZero, as in `Set` and `includes`.
- Errors are native `TypeError` and `RangeError`, never custom classes.

### Ordered maps and sets

```ts
import { SortedMap, SortedSet, SplayTree } from 'atomic-fns/collections'

const scores = new SortedMap([
  ['carol', 7],
  ['alice', 9]
])
scores.set('bob', 8)
;[...scores.keys()] // ['alice', 'bob', 'carol']
scores.at(-1) // ['carol', 7]
scores.rank('bob') // 1
scores.ceiling('b') // ['bob', 8]
scores.entriesBetween('a', 'c') // [['alice', 9], ['bob', 8]]
scores.removeRange('a', 'b') // 1 (alice)
const snapshot = scores.clone() // O(1), copy-on-write

const ids = new SortedSet([30, 10, 20])
ids.higher(10) // 20

const byDate = new SortedMap<Date, string>(undefined, (a, b) => a.getTime() - b.getTime())
```

`SortedMap` is a copy-on-write B+ tree with subtree counts: lookups, `at` and `rank` take O(log n), range queries O(log n + k), and `updateRange` and `removeRange` are atomic, so a throwing callback or comparator leaves the map unchanged. A comparator that returns a non-finite number, or does not return 0 for a key against itself, is rejected before anything changes. `SortedSet` has the same ordered queries over values (`first`, `last`, `lower`, `higher`, `floor`, `ceiling`, `at`, `rank`, `valuesBetween`). `SplayTree` is an ordered map on a randomized splay tree, for skewed access patterns: `get` and `has` move the key they find to the root with probability 0.5, and `firstKey`, `lastKey`, `lower` and `higher` always do.

### Heap, Deque, LRUCache

```ts
import { Deque, Heap, LRUCache } from 'atomic-fns/collections'

const tasks = new Heap([5, 1, 3]) // pass (a, b) => b - a for a max-heap
tasks.pop() // 1

const recent = new Deque<number>([], { maxlen: 3 })
recent.push(1, 2, 3, 4) // 3, the new size
;[...recent] // [2, 3, 4]
recent.unshift(0) // 3
;[...recent] // [0, 2, 3]

const cache = new LRUCache<string, string>(100)
cache.set('/a', '<html>')
cache.get('/a') // refreshes recency; has() does not
```

### Trie and FrozenSet

```ts
import { FrozenSet, Trie } from 'atomic-fns/collections'

const words = new Trie(['car', 'cart', 'cat'])
;[...words.withPrefix('car')] // ['car', 'cart']

const roles = new FrozenSet(['admin', 'editor'])
roles.add('guest') // throws TypeError
```

### Bisect

```ts
import { binarySearch, bisectLeft, bisectRight, insort } from 'atomic-fns/collections'

bisectLeft([1, 2, 2, 3], 2) // 1
bisectRight([1, 2, 2, 3], 2) // 3
insort([1, 3], 2) // [1, 2, 3]
binarySearch([1, 3, 5], 4) // -3: absent, belongs at index 2
const rows = [{ id: 1 }, { id: 4 }]
bisectLeft(rows, { id: 3 }, (a, b) => a.id - b.id) // 1; lo and hi follow the comparator
```

## Objects, arrays and helpers

Lodash's intent on today's platform: object paths, deep equality and cloning, iteration over every shape, array set operations, function and async helpers, strings, numbers, ids, hashing and encoding.

### Collections, objects and arrays

#### Iteration over every shape (`atomic-fns/collections`)

```ts
import {
  countBy,
  entries,
  filter,
  groupBy,
  includes,
  map,
  size,
  sortBy
} from 'atomic-fns/collections'

entries({ a: 1 }) // [['a', 1]]
countBy(['one', 'two', 'three'], (s) => s.length) // { 3: 2, 5: 1 }, null prototype
map(new Map([['x', 1]]), (value, key) => `${key}=${value}`) // ['x=1']
size('👍🏽') // 2 code points
includes(new Set([NaN]), NaN) // true: SameValueZero
filter({ a: 1, b: 2 }, (value) => value > 1) // [2]
groupBy([6.1, 4.2, 6.3], Math.floor) // { 4: [4.2], 6: [6.1, 6.3] }, null prototype
sortBy(users, [(u) => u.name, (u) => u.age]) // stable; null and undefined keys last
```

One rule per shape: arrays and typed arrays give their indices (holes skipped), strings their code points, a `Map` its keys, a `Set` its members, any other iterable its positions, and any other object its own enumerable string keys; `null`, `undefined` and other primitives are empty. Callbacks receive `(value, key, collection)`. `forEach` visits every entry, as the native method does; `some`, `every` and `find` stop early. Key helpers (`sortBy`, `orderBy`, `minBy`, `maxBy`) order numbers, bigints and strings; `null` and `undefined` keys sort last, and `minBy` and `maxBy` skip them. Comparing a `NaN` key throws `RangeError`, and comparing a key of any other type, or a string against a number, throws `TypeError`. Every callback is a function: lodash's `'name'` and `{ active: true }` shorthands are `(u) => u.name` and `matches({ active: true })`.

#### Objects (`atomic-fns/object`)

```ts
import { cloneDeep, get, matches, merge, omit, pick, set } from 'atomic-fns/object'

get({ a: [{ b: 1 }] }, 'a[0].b') // 1
get({ 'a.b': 1 }, "['a.b']") // 1
set({}, 'a.b', 1) // { a: { b: 1 } }
pick({ a: { b: 1, c: 2 } }, 'a.b') // { a: { b: 1 } }
omit({ user: { name: 'a', password: 'p' } }, 'user.password') // { user: { name: 'a' } }
merge({ a: [{ b: 2 }] }, { a: [{ c: 3 }] }) // { a: [{ b: 2, c: 3 }] }
cloneDeep({ when: new Date(0), tags: new Set(['a']) })
users.filter(matches({ address: { city: 'Oslo' } }))
```

A `__proto__`, `constructor` or `prototype` path segment that is not own data of a non-function object reads as missing. `set` throws `TypeError` and `unset` returns `false` for these segments unless they are own data of a plain object or array, and for inherited intermediate steps. `set` writes a terminal `constructor` or `prototype` as own data, refusing an existing own accessor or non-writable property. `merge` copies these three keys as own data and refuses to replace an own `constructor` function with an object. `defaults` and `defaultsDeep` fill `constructor` and `prototype` as own data but skip `__proto__` unless the target has a null prototype; `defaultsDeep` never descends into inherited values. `cloneDeep` copies plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`, typed arrays, `DataView`, buffers and boxed primitives with their prototype and symbol keys, and keeps class instances, functions, errors and promises by reference. `cloneDeep` keeps cycles and shared references; `merge` and `defaultsDeep` keep cycles but give each key its own copy of a shared source plain object or array. Deep walks stop past 1000 levels of nesting with a `RangeError`.

`omit` copies own enumerable string and symbol keys of objects, and elements and own enumerable symbol keys of arrays; `defaults` and `defaultsDeep` consider own enumerable string and symbol keys of each source.

For non-null objects other than arrays and without string, numeric or symbol index signatures, literal tuples of individual top-level keys without `.`, `[` or `]` give `pick` and `omit` exact `Pick` and `Omit` result types; union keys and non-tuple lists of those keys give partial results, and other calls return `Partial<T>`.

#### Arrays (`atomic-fns/array`)

```ts
import { chunk, difference, range, remove, uniqBy, xor, zip } from 'atomic-fns/array'

range(1, 10, 3) // [1, 4, 7]
chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
zip(['a', 'b'], [1, 2]) // [['a', 1], ['b', 2]]
difference([2, 1, 2, 3], [2]) // [1, 3]
uniqBy([2.1, 1.2, 2.3], Math.floor) // [2.1, 1.2]
xor([2, 1], [2, 3]) // [1, 3]
remove(xs, (n) => n % 2 === 0) // removes in place, returns the removed
```

Set operations keep the order of first appearance, drop duplicates and compare with SameValueZero unless a key or equality function is given. Where one native call does the job, use it: `[...new Set(xs)]` for `uniq`, `xs.filter(Boolean)` for `compact`, `xs.filter((x) => x !== y)` for `without`, `xs.flat()` for `flatten`, `xs.toSpliced(i, 0, x)` for `insert`, `Array.from({ length: n }, (_, i) => fn(i))` for `times`, `zip(...rows)` for `unzip`, and `xs.toSorted((a, b) => a - b)` for `sort` and `sorted` on numbers (without a comparator, `toSorted` orders by string).

### Equality, hashing, ids, encoding and type checks

#### Deep equality (`atomic-fns/object`)

```ts
import { isEqual, isEqualWith } from 'atomic-fns/object'

class Point {
  constructor(
    public x: number,
    public y: number
  ) {}
  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y
  }
}

isEqual({ a: [1, { b: NaN }] }, { a: [1, { b: NaN }] }) // true: SameValueZero at the leaves
isEqual(new Map([[1, 'x']]), new Map([[1, 'x']])) // true
isEqual(new Set([{}]), new Set([{}])) // false: members are matched by SameValueZero
isEqual(new Point(1, 2), new Point(1, 2)) // false: class instances compare by identity
isEqualWith([new Point(1, 2)], [new Point(1, 2)], (x, y) =>
  x instanceof Point && y instanceof Point ? x.equals(y) : undefined
) // true
```

Plain objects, arrays, `arguments`, Dates, RegExps (source, flags and `lastIndex`, with SameValueZero for `lastIndex`), typed arrays, `DataView` and buffers, boxed primitives and errors (name, message, own `cause` and `errors`, and own enumerable properties, not `stack`) compare by content, from any realm. `Map` compares by key membership and then value, `Set` by membership; both match by SameValueZero, so object keys and members match by identity. Other class instances compare by identity. Cycles are compared once, and nesting past 1000 levels throws `RangeError`.

#### `atomic-fns/hash`

```ts
import { digest, hash, hashString, stableStringify } from 'atomic-fns/hash'

hash({ a: 1, b: 2 }) === hash({ b: 2, a: 1 }) // true: isEqual(a, b) implies hash(a) === hash(b)
hashString('a') // 3826002220, FNV-1a over UTF-8
stableStringify({ b: 1, a: 2 }) // '{"a":2,"b":1}'
await digest('SHA-256', 'abc') // 'ba7816bf...'
```

`hash` reads at most 8 levels deep, so it never throws on deep, cyclic or huge sparse input (no 1000-level `RangeError`). `stableStringify` calls `toJSON`, as `JSON.stringify` does.

#### `atomic-fns/id`

```ts
import { nanoid, uniqueId, uuid, uuidv7 } from 'atomic-fns/id'

`user_${uniqueId()}` // 'user_1'
uuid() // random v4
uuidv7() // time-ordered: sorts by creation time to the millisecond, and in creation order within one process
nanoid() // 21 URL-safe characters
```

`uniqueId()` takes no prefix and returns the next id from a realm-wide counter as a decimal string; like `crypto.randomUUID`, it ignores arguments passed at runtime, so add a prefix with a template string.

#### `atomic-fns/encoding`

```ts
import { fromBase64, fromHex, toBase64, toHex } from 'atomic-fns/encoding'

const bytes = new Uint8Array([251, 255])

toBase64('hi') // 'aGk='
toBase64(bytes, { alphabet: 'base64url', omitPadding: true }) // '-_8'
fromBase64('aGk=') // Uint8Array [104, 105]
toHex(new Uint8Array([0, 255])) // '00ff'
fromHex('00ff') // Uint8Array [0, 255]
```

#### `atomic-fns/is`

```ts
import { isArrayLike, isError, isNil, isPlainObject } from 'atomic-fns/is'

isPlainObject(Object.create(null)) // true
isArrayLike('abc') // true
isError(new TypeError('x')) // true, from any realm
isNil(undefined) // true
```

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
