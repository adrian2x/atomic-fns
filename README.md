# atomic-fns

[Read the Docs](https://atomic-stack.github.io/atomic-fns/)

## Like Lodash, but in TypeScript and for ESNext.

Stop shipping code built for browsers from 2015.

You may prefer this library because:

- **TypeScript & docs**: Includes type declaration files and js with JSDocs for best in class experience.
- **Zero deps**: Built from scratch with no runtime dependencies or polyfills.
- **ESNext**: Uses modern idiomatic syntax, data structures, and control flow techniques.
- **Modular**: Pick what you need. Supports tree-shaking, no side effects, and works with all bundlers.
- **Lazy**: Leverage generators, iterators, and functional composition.
- **Tests**: Vitest with v8 coverage thresholds of lines 90, statements 90, functions 90, and branches 85.

## Docs

Available at [atomic-fns](https://atomic-stack.github.io/atomic-fns/)

## Get Started

This library is available as an [npm package](https://www.npmjs.com/package/atomic-fns).

Requires Node.js >= 24.

```bash
npm install atomic-fns
```

## How to use

Just import any function or class you need.

```js
import { sorted, times, uniqueId } from 'atomic-fns'

;[...times(5, (i) => i)]
// -> [0, 1, 2, 3, 4]

sorted([4, 3, 2, 1])
// -> [1, 2, 3, 4]

uniqueId('user_')
// -> 'user_1'
```

See the full list of [modules](https://atomic-stack.github.io/atomic-fns/modules.html).

## Data model

This library features a data model similar to [Python](https://docs.python.org/3/reference/datamodel.html#special-method-names) but not always. Only the missing parts have been implemented, while respecting the JS standards.

For example, in Python collections, `size()` is a method, while in JS it's just a property. So this library uses `size` property instead of method. Similarly, the `len` function implementation checks for both `length` and `size` since many JS objects have a `length` property.

## Protocol operators

Equality, ordering, arithmetic, cloning, and truthiness dispatch only on exported symbols in `protocol` (for example `protocol.compare`, `protocol.equals`). String method names such as `eq` / `lt` / `compare` on user objects are not called unless you opt in with `adaptProtocol`.

```js
import { adaptProtocol, compare, protocol, sorted } from 'atomic-fns'

class V {
  constructor(n) {
    this.n = n
  }
  compare(o) {
    return this.n - o.n
  }
}
adaptProtocol(V)
compare(new V(2), new V(1)) // 1
sorted([new V(2), new V(1)]).map((v) => v.n) // [1, 2]

const o = {
  [protocol.add](y) {
    return 42
  }
}
```

`eq` is value (numeric/semantic) equality. `compare` is a total order that keeps values of different kinds distinct, like Map keys (the only place unit/kind tie-breaks live). Relational checks - operators `lt`/`lte`/`gt`/`gte`, math `min`/`max`, and Decimal/Currency methods `compare`/`lt`/`lte`/`gt`/`gte` - compare rank-1 values (number, bigint, Decimal, Currency, and anything with a `protocol.unit` string) numerically only: equal amounts of any kind compare equal, so `eq(a, b)` implies `lte(a, b) && gte(a, b)`. The single remaining difference is the total-order tie-break: `compare(decimal(1), 1) === 1` while every relational check treats them as equal (`decimal(1).lte(1) === true`, `lte(decimal(1), 1) === true`). `new SortedSet([decimal(1)]).has(1) === false` because SortedSet keys use `compare`. With a Decimal or Currency on either side, `eq` is numeric equality plus the same unit when both sides carry one, so it is not transitive across units (`USD 5 = 5 = JPY 5`, but `USD 5 != JPY 5`). Between primitives `eq` is SameValueZero, so `eq(1, 1n)` is false while `lte` and `gte` both hold, just as `1 === 1n` is false while `1 <= 1n` and `1 >= 1n` are true. A user class gets `protocol.equals` when it defines it, otherwise `compare(x, y) === 0` when it defines `protocol.compare`. Units come from `protocol.unit` (`Symbol.for('atomic-fns.unit')`). Compare money with money; a plain-number threshold matches any currency (`gte(new Currency(100, 'JPY'), 100) === true`).

## New Types

[`Decimal`](https://atomic-stack.github.io/atomic-fns/classes/decimal.Decimal.html) provides support for correct rounded floating point arithmetic: exact decimal arithmetic up to 10,000 significant digits (`MAX_DIGITS`) and 10,000 fractional digits of precision (`MAX_PRECISION`). Near the digit cap each operation costs on the order of 0.2 ms, so totals over many attacker-chosen items grow linearly - size-limit untrusted lists.

This fixes precision issues with float arithmetic, for example:

```
0.1 + 0.1 + 0.1
// 0.30000000000000004

decimal('0.1').add('0.1').add('0.1').toNumber()
// 0.3
```

Some common base interfaces and typing patterns you may have seen like `Optional`, `Result`, `Comparable`, `Iterator`, and others.

### Sorted Containers

- [SortedSet](https://atomic-stack.github.io/atomic-fns/classes/collections.SortedSet.html)
- [SortedMap](https://atomic-stack.github.io/atomic-fns/classes/collections.SortedMap.html)

### Other Containers

- [Deque](https://atomic-stack.github.io/atomic-fns/classes/collections.Deque.html)
- [FrozenSet](https://atomic-stack.github.io/atomic-fns/classes/collections.FrozenSet.html)
- [LRUCache](https://atomic-stack.github.io/atomic-fns/classes/collections.LRUCache.html)
- [BTree](https://atomic-stack.github.io/atomic-fns/classes/collections.BTree.html)
- [SplayTree](https://atomic-stack.github.io/atomic-fns/classes/collections.SplayTree.html)
- [Heap](https://atomic-stack.github.io/atomic-fns/classes/collections.Heap.html)
- [Trie](https://atomic-stack.github.io/atomic-fns/classes/collections.Trie.html)

## Migrating to 2.0

Breaking changes from 1.1.7. There is no deprecation release; removed names are gone.

### Removed

| Before (1.1.7)                                                                                                           | Use instead                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `bind`, `callAsync`, `isArray`, `values`, `floor`, `ceil`, `isInteger`, `log2`                                           | natives (`Function.prototype.bind`, `Array.isArray`, `Object.values`, `Math.*`) |
| `id`                                                                                                                     | `identity`                                                                      |
| `HASH_KEY`, `IterableIterator`                                                                                           | gone (`hash` uses a WeakMap; iterators are native)                              |
| `SortedTree`                                                                                                             | `SortedMap`                                                                     |
| Interfaces `Container`, `Equals`, `Comparable`, `Ordered`, `Reversible`; abstract `Mapping`, `Sequence`                  | `SetCollection`, `MapCollection`                                                |
| Collection `empty()`, `length`; Mapping `add(key)`; LRUCache `remove`; SplayTree `top`; Heap `at`; Deque `remove`, `add` | JS protocol names below                                                         |
| String-method protocol dispatch (`obj.eq` / `obj.compare` called automatically)                                          | symbol hooks or `adaptProtocol(Class)`                                          |
| `cloneArray`, `cloneTypedArray`                                                                                          | `clone` / `.slice()`                                                            |
| `list(arrayLike)`                                                                                                        | `list(Array.from(arrayLike))`                                                   |
| `UNITS_PLURAL`, `parseISODuration`                                                                                       | `durationField`, `Duration.from`                                                |
| `unfreeze` on BTree / SortedMap / SortedSet                                                                              | gone; `freeze` is one-way                                                       |

### Renamed

| Before                                                                                                                                                                | After                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contains` (method)                                                                                                                                                   | `has`                                                                                                                                                                     |
| method `remove`                                                                                                                                                       | `delete` (returns boolean)                                                                                                                                                |
| Deque `append` / `appendleft` / `popleft` / `get` / `first` / `reversed`                                                                                              | `push` / `unshift` / `shift` / `at` / `at(0)` / `toReversed`                                                                                                              |
| Heap `add` / `top`                                                                                                                                                    | `push` / `peek`                                                                                                                                                           |
| BTree `removeRange` / `removeKeys` / `rangeUpdate` / `rangeForEach` / `keysRange` / `extend` / `reversed` / `minKey` / `maxKey` / `maxNodeSize`                       | `removeRange` (options object) / `removeAll` / `updateRange` / `visitRange` / `entriesBetween` / `setAll` / `entriesDescending` / `firstKey` / `lastKey` / `nodeCapacity` |
| SplayTree `lowerBound`                                                                                                                                                | `lower`                                                                                                                                                                   |
| SortedMap `reversed`                                                                                                                                                  | `entriesDescending`                                                                                                                                                       |
| type `Function`                                                                                                                                                       | `AnyFunction`                                                                                                                                                             |
| `omit(instance, keys)` on a class instance / Array subclass / value with callable or accessor `toJSON`                                                                | `omit({ ...instance }, keys)` after deciding which fields are safe; a data `toJSON` holding a non-function is ordinary data                                               |
| `flatten` silently overwriting when a dotted key collided with a nested path                                                                                          | throw `TypeError`; rename one of the colliding source keys                                                                                                                |
| `flatten` on objects whose keys contain `.`, `[`, `]`, or the empty string (aliasing nested paths)                                                                    | throw `TypeError(\`flatten cannot represent key …\`)`; rename keys before flattening                                                                                      |
| `get('toString', {})` / `get('constructor.constructor', {})` resolving built-in prototypes                                                                            | returns the default; own keys and user-class prototype members still resolve                                                                                              |
| `Currency` mixed-currency `add`/`sub`/`mul`/`div`/`lt`/`lte`/`gt`/`gte`/`compare`                                                                                     | throws `ValueError('currency mismatch: …')`; convert explicitly or use same-currency amounts                                                                              |
| operators `lt`/`lte`/`gt`/`gte` and `math` `min`/`max` over values with different unit codes                                                                          | throw `ValueError('currency mismatch: X vs Y')`; `compare` and `sorted` never throw and order by amount, then unit code (`''` for unit-less), then kind                   |
| `set('a.b', obj, v)` / `del('a.b', obj)` / `has(obj, 'a.b')` treating a dotted string as one literal key                                                              | strings split on `.` and walk the path, as `get` always did; pass `['a.b']` for the literal key                                                                           |
| `has([], 'push')` / `has({}, 'toString')` resolving built-in prototypes                                                                                               | returns `false`; own keys and user-class prototype members still count                                                                                                    |
| `set('5', [], v)` writing past the end of an array                                                                                                                    | throws `RangeError('array index beyond length')`; `merge` and `defaults` refuse the same keys, and `merge` refuses a source `length` that would grow an array target      |
| path segments that are not strings, numbers or symbols (`get([true], obj)`)                                                                                           | throw `TypeError('path segments must be strings, numbers or symbols')`                                                                                                    |
| huge sparse arrays (length above 2\*\*24 and mostly holes) passed to `list`, shallow `clone`, `pick`, `merge`, `flatten` at depth 0 or less, and the iterator helpers | throw `RangeError('sparse array too large')`                                                                                                                              |
| `debounce` / `throttle` waits above the `setTimeout` range                                                                                                            | throw `RangeError('wait must be between 0 and 2147483647 ms')`; negative waits clamp to 0                                                                                 |

### Added

`protocol`, `adaptProtocol`, `reject`, `without`, `symmetricDifference`, Decimal rounding options, `Duration.format`, `durationField`, Deque `maxlen`, `BTree.at` / `SortedMap.at` / `SortedSet.at`, `next(it, dflt)`, debounce `cancel` / `flush`.

### Signature and behavior notes

- Map-like `set` returns `this`. `uniqueId` returns a string. `hash` returns a number for all inputs. `CustomError(message, options)` forwards `cause`.
- `cache` is a TC39 method decorator. `sorted(it, options)` accepts `{ key, reverse, compare }`. `Decimal.div(x, opts)` takes `{ precision, rounding }`. `Deque(items, { maxlen, arrType })`.
- `remove(arr, pred)` mutates and returns removed elements (Lodash). Prefer `without(arr, ...values)` for the old pure value form; `reject` is the pure predicate form.
- `compare` is a total order across kinds; `eq` is semantic equality (see Protocol operators). Decimal compare/equals with numbers uses exact binary values (`decimal('0.1').eq(0.1) === false`).
- Decimal bounds are all 10,000: `MAX_EXPONENT` (`|e| <= 10000`), `MAX_PRECISION` for `div` / `sqrt` / `round` (round also accepts down to `-MAX_EXPONENT`), and `MAX_DIGITS` significant digits. Work and results of every arithmetic operation are bounded by significant digits (not by the exponent); constructor, parse, and arithmetic throw `RangeError('result exceeds 10000 digits')` when a result would exceed it. Exact terminating / perfect-square results may still use any allowed exponent. `toNumber` converts from coefficient and exponent directly (never via a full plain string). `range(NaN)` throws. `uuid` throws without Web Crypto. `difference` is set difference. Decimal `valueOf` throws.
- `formatDate` tokens are maximal ASCII letter runs (plus `Do` / `LT` / `LTS`); unknown runs stay literal as a whole. `YYYY` / strftime `%Y` zero-pad to 4 digits (`0050`, `-0001`); `YY` / `%y` are `|year| % 100` zero-padded to 2. `strftime` supports `%%` -> `%`; unknown directives stay literal. Formatter cache is a capacity-64 LRU.
- `IntlDate.set` accepts only `DateObject` field names (singular or plural). Unknown units throw `ValueError`. Keys that 1.x silently ignored via `UNITS_SINGULAR` (`weeknumber`, `weekyear`, `ordinal`, `quarter`, and their plurals) now throw. Setting a field inside a repeated local hour keeps the receiver's offset when that offset remains valid.
- `IntlDate.add` / `subtract`: calendar fields advance the wall date once (month-end constrain), then time fields add exact milliseconds. Unknown or non-finite duration fields throw `ValueError`; results outside the Date range throw `RangeError`.
- `IntlDate.diff` follows Temporal `until` / `total` (calendar-correct years/quarters/months/weeks/days; truncates toward zero unless `exact`).
- `IntlDate.from` / `to` / `fromNow` / `toNow`: omitting the unit picks the largest of years, months, days, hours, minutes, seconds with absolute count at least 1; a zero count uses `Intl.RelativeTimeFormat` `numeric: "auto"` ("today", "now", ...).
- `IntlDate.min` / `IntlDate.max` take one `readonly DateLike[]` (no varargs); empty or all-invalid still returns `undefined`.
- `weekOfYear(date, firstDay = 1, minimalDays = 4, utc)` and `weeksInYear(year, firstDay = 1, minimalDays = 4)` use CLDR week rules (ISO by default). The third parameter is `minimalDays` (1..7), not a day-of-year threshold. `IntlDate.week()` / `weekYear()` / `weeksInYear()` follow the instance locale (`Intl.Locale` week info, with a CLDR `minimalDays` fallback table because engines do not yet expose `minimalDays`); `isoWeek()` / `isoWeekYear()` / `isoWeeksInYear()` are ISO 8601. `startOf('week')` uses the locale first day; `startOf('isoWeek')` is Monday. Day-or-larger `startOf` / `endOf` use compatible wall resolution; hour/minute/second keep the receiver's offset when valid.
- `asDate` parses a strict ISO-8601 / ECMA-262 Date Time String subset: out-of-range fields are invalid, years 0-99 are literal, date-only and zone-less strings use local wall time (unless `utc`), and non-ISO strings longer than 128 characters are invalid.
- `Duration` is frozen and exact at 1 ns (`bigint`). Calendar units share one year length (365-day year, or mean Gregorian 365.2425 d in exact mode) so 1 year = 4 quarters = 12 months. Constructor inputs are finite numbers under the nine plural field names (else `ValueError`); ISO strings go through `Duration.from` (Temporal-style grammar: leading sign only, case-insensitive, `.`/`,`, fraction only on the last time component, <= 9 digits, components <= `MAX_SAFE_INTEGER`). `round({ largestUnit })` redistributes across a unit slice; weeks appear only when `largestUnit` is `'weeks'` (Temporal), otherwise that time folds into days. `toISOString` uses one leading sign, normalizes mixed signs, keeps only seconds fractional, and prints `PT0S` for anything that rounds to 0 ns. Zero `format` is `0 sec`. `durationField(unit)` replaces `UNITS_PLURAL`.
- `matches` follows Lodash `isMatch`: a top-level empty `{}` / `[]` matches any value; a nested empty `{}` matches only a non-null non-array object and a nested empty `[]` matches only an array; arrays in the shape are subsets; `{ a: undefined }` requires own key `a`; Date/RegExp/Map/Set/typed-array shape values use deep equality (not reference). Nesting past 1000 levels throws `RangeError`.
- `deepEqual`, `clone` (deep), `merge`, and `flatten` also throw `RangeError` past 1000 levels of nesting (security bound). Collection `protocol.equals` / `protocol.clone` hops charge 8 levels each (`HOOK_NESTING_COST`), so self-nested collections are capped at 125 levels (1000 / 8) before the same `RangeError` - enough that the native stack still has headroom when the counter fires.
- `deepEqual` remembers at most 2^20 failed and 2^21 proven pairs per call. Past those bounds memory stays flat, but work on crafted shared input can multiply per level again.
- `clone` copies Node `Buffer`s and own enumerable symbol keys; `DataView` keeps offset/length over a full buffer copy; deep `Map` keeps key identity and deep-clones values; RegExp match arrays keep `index`/`input`/`groups`; class instances stay by reference. `clone(collection, true)` passes `deep` to `protocol.clone`: map-like collections keep keys by reference and deep-clone values; set-like deep-clone values. One deep `clone` call copies each object once, also through `protocol.clone` hooks, so references shared inside a collection stay shared in the copy, as they do in arrays: `clone(new Deque([row, row]), true)` holds one copy of `row`. Collection equality is order-independent for set-like (FrozenSet, Trie) and map-like (LRUCache) types, multiset for Heap (deepEqual multiset, comparator-independent), and sequence for Deque/SortedMap/SortedSet/BTree/SplayTree.
- `merge` copies own enumerable symbol keys. When a path's target and source containers differ in kind (array vs plain object), the source replaces the target. Each key gets its own copy of a shared source (cycle protection is path-scoped only); shared re-expansions are capped at 500,000 copied nodes (`RangeError('input repeats shared objects beyond 500000 copied nodes')`). `matches` remembers (shape, value) pairs that are expensive to walk again, proven or failed, up to 2^20 pairs with the cheapest evicted first, and caps its leaf-key index so memory stays linear in the input. `flatten` has its own lower cap of 250,000 work units (`RangeError('input repeats shared objects beyond 250000 output keys')`). Both budgets count containers, not keys, so a large row shared many times copies more properties or emits more keys than the cap number.
- `pick` / `omit` accept array-of-segments paths for literal keys (`[['a.b']]`); string paths still split on `.`. `pick` mirrors array vs object containers from the source. `omit` is O(keys + paths), never invokes getters of omitted keys; kept data values use a normal `[[Get]]` (symbol keys are not copied). Top-level input and every descended container must be a plain object or plain array (prototype `Object.prototype`/`null`/`Array.prototype`) without a callable or accessor `toJSON`; class instances, Array subclasses, Maps, Dates, collections, functions, and values with a function/accessor `toJSON` throw `TypeError` (fail closed). A data `toJSON` holding a non-function is ordinary data. Values not on a path stay by reference.
- `isEmpty(fn)` ignores arity; a function is empty unless it has own enumerable properties. Length applies only to arrays, strings, arguments, typed arrays/Buffers, and splice-able objects; size only to Map/Set and non-plain collections. Plain `{ length: 0, ... }` / `{ size: 0, ... }` count own keys (not empty when other keys exist).
- `uniq` / `without` normalize `-0` to `+0` in results (native Set semantics).
- `defaults` fills keys whose own value is `undefined`, or that are missing as own and equal `Object.prototype[key]` (e.g. plain `toString`); inherited class getters/methods are never overridden. Writes use assignment (setters run) except `__proto__` (defineProperty, null-prototype targets only).
- `words` uses `Intl.Segmenter` word granularity plus Unicode letter/digit, ordinal (`11th`), plural-acronym (`IDs`), and RGI emoji rules; an optional `pattern` is a separator. `camelCase` / `pascalCase` / `snakeCase` / `kebabCase` strip apostrophes and uppercase with `toUpperCase` (so `pascalCase('ǆemal')` is `Ǆemal`). `titleCase` only title-cases the first letter of each word (rest unchanged). `capitalize` uses Unicode titlecase for digraphs (`ǆ` -> `ǅ`). `removeAccents` / `slugify` follow the Unicode CLDR Latin-ASCII transform (NFD, strip Mn after Latin letters or ASCII digits, NFC, then letter folds); non-Latin marks are kept.
- `throttle` uses Lodash leading+trailing defaults (latest args at window end). `throttle(fn, 0)` is leading plus one trailing per macrotask. `memoize` exposes `.cache` and `.clear()`.
- `compare` fast-paths same-type non-NaN numbers and strings; total order unchanged.
- `BTree` is a copy-on-write order-statistic B+ tree: `clone()` is O(1) until either side writes; a non-finite comparator result throws `TypeError('comparator must return a finite number')` and leaves the tree unchanged; `setAll` / `removeAll` / `removeRange` / `updateRange` are atomic; iteration under mutation never repeats a key and always terminates; `at(index)` is O(log n) with Array.prototype.at index rules; `nodeCapacity` is an integer in 8..1024 (default 64, else `RangeError`); `freeze()` is one-way. Numeric subtraction comparators reject `Infinity` / `NaN` keys (those differences are not finite) - use the default `compare` when those keys matter.

### Platform

Node >= 24; ESM `exports` subpaths; jasmine replaced by vitest.

## Releasing

One-time owner setup (must complete before any 2.0 release), in this order:

1. Create a GitHub environment named `npm` with a required reviewer and a deployment rule of type `tag` matching `v*` only (no branch rules). Confirm both the required reviewer and the tag rule show on the environment page. GitHub auto-creates a referenced environment with no protection, so this step must precede any release.
2. Create a repository ruleset that restricts who can create `v*` tags.
3. On npm, bind a trusted publisher to this repository, workflow `publish.yml`, environment `npm`.
4. Once this branch is merged to main and no workflow on main references `NPM_TOKEN`, delete the repository secret `NPM_TOKEN`, revoke that npm token, and set the package to "Require two-factor authentication and disallow tokens", all before creating the first 2.0 release (a failed trusted publish fails safely and can be retried).

## Contributing

If you want to contribute to the project and make it better, your help is very welcome. Contributing is also a great way to learn more about social coding on Github, new technologies and their ecosystems and how to make constructive, helpful bug reports, feature requests and the noblest of all contributions: a good, clean pull request. You will be listed as a **Champion** on the official site as well.

## License

[Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)
