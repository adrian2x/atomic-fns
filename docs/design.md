# atomic-fns design

atomic-fns is one package that fills the gaps the platform leaves, so apps can drop lodash and similar grab-bags. It has no runtime dependencies and publishes as `atomic-fns` on npm and `@atomic-stack/atomic-fns` on JSR.

Every export is available from the root (`import { Decimal, keys, Heap } from 'atomic-fns'`) and its area subpath. Tree-shaking keeps the per-function cost.

| Subpath | What it is |
|---|---|
| `atomic-fns/collections` | iteration over every collection shape, sorted maps and sets, trees, heap, deque, LRU cache, trie, frozen set and bisect |
| `atomic-fns/decimal` | exact decimal arithmetic shaped after the TC39 Decimal draft, plus `Currency` |
| `atomic-fns/object`, `atomic-fns/array`, `atomic-fns/function`, `atomic-fns/async`, `atomic-fns/string`, `atomic-fns/number`, `atomic-fns/random`, `atomic-fns/id`, `atomic-fns/hash`, `atomic-fns/encoding`, `atomic-fns/is` | object paths, deep equality and cloning, array set operations, function wrappers, async helpers, string case conversion, number helpers, ids, hashing, encoding and type checks |

Supported runtimes: Node `^24.22.3 || >=26.13.1`, Deno, Bun, browsers at Baseline and workers. Published types support TypeScript 6.0 and later.

## Rules

1. **The platform first.** A helper exists only when no single native call does the same job in every supported runtime: browsers at Baseline, Node `^24.22.3 || >=26.13.1`, Deno, Bun and workers. When the platform ships the feature everywhere, the helper is deleted. When a runtime lacks it, the helper uses the native API where present and a portable fallback elsewhere, and the fallback goes once every supported runtime has it. Code uses only portable primitives (`crypto.getRandomValues`, `crypto.subtle`, `TextEncoder`, `Intl`); never a `node:*` import.
2. **Lodash names and intent, platform semantics.** A helper that replaces a lodash function takes its name and does what it is for. Its parameters and edge cases follow the platform and the objects it works with, not lodash's quirks: callbacks receive `(value, key, collection)` as `Map.prototype.forEach` does, equality is SameValueZero as in `Map`, `Set` and `includes`, ordering follows `toSorted`, and errors are native. 100% lodash compatibility is not a goal. Lodash's iteratee shorthands (`'name'`, `{ active: true }`, `['a', 1]`) are not supported: every callback is a function.
3. **No protocol.** There are no symbols, no `Comparable`, `Equatable` or `Rank` interfaces, no operator functions (`compare`, `eq`, `add`, ...), and no duck-typed method dispatch. Code never calls a method it did not define on a value it was given. Two helpers call one by contract, because that call is what the caller asks for: `stableStringify` calls a value's own or inherited `toJSON` with its key, as `JSON.stringify` does, and `memoize` calls its `resolver` and the `has`, `get` and `set` methods of its replaceable `cache`.
4. **Ordering is a parameter.** Sorted structures and `bisect` take a comparator `(a, b) => number`. Key helpers (`sortBy`, `orderBy`, `minBy`, `maxBy`) take key functions. The default comparator orders primitives only: numbers (NaN throws), bigints (compared exactly with numbers) and strings (by UTF-16 code units, as `<` does). `null` and `undefined` keys sort last in key helpers. Anything else throws a `TypeError` that asks for a comparator. Sorted structures treat `compare(a, b) === 0` as the same key.
5. **Equality.** Membership, `uniq*`, `difference*` and the collections use SameValueZero. `isEqual` compares structure (see `atomic-fns/object`); `isEqualWith` and `uniqWith` take an equality function.
6. **Value types are shaped like Temporal.** `Decimal` and `Currency` have `static compare(a, b)` for passing to sorts and collections, instance `compare`, `equals`, `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, `toString`, `toJSON` and `toLocaleString`, and a `valueOf` that throws `TypeError` so `<` and `+` cannot silently coerce. No `clone`, `hash` or `Symbol.toPrimitive`.
7. **Native errors.** `TypeError` for a value of the wrong type, `RangeError` for a value out of range or in conflict (a bad index, a currency mismatch, division by zero, a depth limit). A helper that stands in for a native decoder throws what the native one throws: `fromBase64` and `fromHex` throw `SyntaxError` for malformed text, as `Uint8Array.fromBase64` and `Uint8Array.fromHex` do. No custom error classes.
8. **Hostile input.** Path reads treat `__proto__`, `constructor` and `prototype` segments as missing unless they are own data of a non-function object. `set` and `unset` refuse these segments unless they are own data of a plain object or array, and refuse inherited intermediate steps; `set` writes a terminal `constructor` or `prototype` as own data, refusing existing own accessors and non-writable properties. `merge` defines these keys as own data and refuses to replace an own `constructor` function with an object. `defaultsDeep` fills `constructor` and `prototype` as own data, skips `__proto__` unless the target has a null prototype, and never descends into inherited values. Deep walks (`isEqual`, `isMatch`, `matches`, `cloneDeep`, `merge`, `defaultsDeep`, `omit`, `flattenObject`, `stableStringify`) handle cycles and stop past 1000 levels of nesting with a `RangeError` instead of overflowing the stack; `flattenObject` and `stableStringify` throw `TypeError` on a cycle, as `JSON.stringify` does. `hash` reads at most 8 levels below the root and counts deeper structure only by its kind, so it never throws on deep input. Nothing allocates from an attacker-chosen length.
9. **Small public surface.** Export what users call. Internals stay in `src/internal/` and are not exported. Every export has JSDoc with an example; `deno doc --lint` passes.

## Helpers

### `atomic-fns/collections` - iteration over every shape

Works on plain objects, arrays, strings, `Map`, `Set`, any other iterable, and `null`/`undefined` (as empty). Results are arrays unless noted. One rule per shape:

| Shape | key | value | order |
|---|---|---|---|
| plain object or other non-iterable object | own enumerable string key | its value | `Object.keys` order |
| array, typed array | index (number) | element | index order; holes are skipped, as `forEach` skips them |
| string | code point index (number) | code point (string) | by code point |
| `Map` | map key | map value | insertion |
| `Set` | the value (as `Set.prototype.keys`) | the value | insertion |
| other iterable | position (number) | element | iteration |

Callbacks get `(value, key, collection)`.

- `keys`, `values`, `entries`, `size`, `isEmpty`, `includes(collection, value)` (SameValueZero against values; for a string, substring as `String.prototype.includes`).
- `forEach`, `forEachRight`, `map`, `flatMap`, `filter`, `reject`, `find`, `findLast`, `some`, `every`, `reduce`, `reduceRight`.
- `groupBy`, `countBy`, `keyBy`, `partition` (`[pass, fail]`), `sortBy`, `orderBy` (`'asc' | 'desc'` per key), `minBy`, `maxBy`, `sumBy`, `meanBy`.
- `sample`, `sampleSize`, `shuffle` (live in `atomic-fns/random`, accept any shape the same way).
- `forEach` and `forEachRight` visit every entry, as the native `forEach` does; use `some`, `every` or `for...of` to stop early.

### `atomic-fns/object`

- `get(obj, path, defaultValue?)`, `set(obj, path, value)`, `has(obj, path)`, `unset(obj, path)`. Lodash argument order. A path is a dotted string with `[0]` and `['key']` segments, or an array of keys. `set` creates plain objects, or arrays for integer segments.
- `pick(obj, paths)`, `omit(obj, paths)`, `pickBy(obj, predicate)`, `omitBy(obj, predicate)`.
- `merge(target, ...sources)` (deep, mutates and returns `target`; plain objects and arrays merge, other values replace), `defaults(obj, ...sources)` (fills keys that are `undefined`), `defaultsDeep`.
- `cloneDeep(value)`: plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`, typed arrays, `ArrayBuffer`, `DataView` and boxed primitives are copied with their prototype, symbol keys and Map key identity; other class instances and functions are kept by reference (documented; `structuredClone` throws on them, lodash produces broken copies).
- `isEqual(a, b)`: the types above compare by content (SameValueZero at the leaves, `Map` and `Set` by key membership then value); other class instances compare by identity, so `isEqual(new Decimal('1'), new Decimal('2'))` is false. `isEqualWith(a, b, customizer)` lets callers compare their own types (return `undefined` to fall through).
- `isMatch(obj, source)`, `matches(source)`: `obj` has every path in `source` with an `isEqual` value; arrays in `source` match as subsets, as lodash does.
- `isPlainObject`, `flattenObject(obj, { delimiter })`, `invert`, `mapKeys`, `mapValues`.

### `atomic-fns/array`

- `chunk`, `zip`, `range(start?, stop, step?)` (Python bounds; returns an array), `remove(array, predicate)` (mutates, returns removed), `dropWhile`, `takeWhile`.
- `uniqBy`, `uniqWith`, `difference`, `differenceBy`, `differenceWith`, `intersection`, `intersectionBy`, `union`, `unionBy`, `xor`, `xorBy`: order of first appearance, duplicates removed, SameValueZero unless a key or equality function is given.

Deleted because one native call does it: `uniq` (`[...new Set(xs)]`), `compact`, `without` (`filter`), `flatten` (`flat`), `insert` (`toSpliced`), `times` (`Array.from({ length })`), `unzip` (`zip(...rows)`), `sort`/`sorted` (`toSorted`), and lazy iteration (Iterator helpers).

### `atomic-fns/function`

`debounce` (`leading`, `trailing`, `maxWait`) and `throttle` (`leading`, `trailing`), both with `cancel`, `flush` and `pending`; `memoize` (`resolver`, a replaceable `cache` with the `Map` interface), `once`, `curry`, `flow`, `compose`.

### `atomic-fns/async`

`sleep(ms, { signal })`, `timeout(promise, ms, { signal })` (rejects with a `DOMException` named `TimeoutError`, as `AbortSignal.timeout` does), `retry(fn, { retries, minDelay, maxDelay, factor, jitter, signal, shouldRetry })`.

### `atomic-fns/string`

`words` (Unicode-aware, splits `fooBar` and `HTTPServer`), `camelCase`, `kebabCase`, `snakeCase`, `pascalCase`, `startCase`, `capitalize`, `deburr`, `slugify`, `truncate(str, { length, omission })` (never splits a grapheme). Each helper reads its text argument as lodash's `toString` does: `null` and `undefined` read as `''`, and any other value goes through `String`.

### `atomic-fns/number`

`clamp`, `inRange`, `round(n, digits?)`, `floor(n, digits?)`, `ceil(n, digits?)` (exact decimal rounding of the printed value, not `toFixed`), `sum`, `mean`, `formatBytes(n, { locale, binary })`.

### `atomic-fns/random`

`random(min?, max?, { float })`, `randomInt(min, max)`, `sample`, `sampleSize`, `shuffle`. Uses `Math.random` unless given `{ random }`.

### `atomic-fns/id`

`uniqueId()`, `uuid()` (v4; `crypto.randomUUID` when present, else `getRandomValues`), `uuidv7()` (RFC 9562), `nanoid(size?, alphabet?)`.

### `atomic-fns/hash`

`hashString(str)` (FNV-1a 32-bit), `hash(value)` (structural, consistent with `isEqual`: `isEqual(a, b)` implies `hash(a) === hash(b)`), `stableStringify(value)` (sorted keys; throws `TypeError` on cycles and bigint, as `JSON.stringify` does), `digest(algorithm, data)` (hex string over `crypto.subtle`; throws `TypeError` where it is missing).

### `atomic-fns/encoding`

`toBase64`, `fromBase64`, `toHex`, `fromHex`, for `Uint8Array` and strings (UTF-8), with a base64url option. Native `Uint8Array` methods when present, a fallback otherwise. Malformed input throws `SyntaxError`, as the native methods do.

### `atomic-fns/is`

`isArrayLike`, `isError` (until `Error.isError` is Baseline), `isNil`, `isPlainObject` (also from `atomic-fns/object`). Plain `typeof` and `instanceof` checks are not re-exported.

## `atomic-fns/decimal`

`Decimal` with the draft's names: `add`, `subtract`, `multiply`, `divide(other, { precision, roundingMode })`, `remainder`, `negate`, `abs`, `sqrt`, `round(digits, roundingMode)`, `compare`, `equals`, the relational methods, `static compare`, `toString`, `toFixed`, `toPlainString`, `toJSON`, `toLocaleString`, `toNumber`, `toBigInt`, `valueOf` that throws. Rounding modes: `ceil`, `floor`, `expand`, `trunc`, `halfCeil`, `halfFloor`, `halfExpand`, `halfTrunc`, `halfEven`. Arguments may be a `Decimal`, a string, a bigint or a finite number. A number is read through its shortest round-trip string (what `String(n)` prints), not its exact binary value, so `0.1` is exactly `0.1` and `2 ** 60` reads as `1152921504606847000`; pass a bigint or a string for an exact large integer. Bounded at 10,000 digits.

`Currency` holds an amount (`Decimal`) and an ISO 4217 code, as the Stage 2 Amount proposal does, instead of extending `Decimal`. Arithmetic and comparison with another currency throw `RangeError`; `equals` returns `false`. `format(locale?, options?)` goes through `Intl.NumberFormat`.

## `atomic-fns/collections` - data structures

`SortedMap` (on a copy-on-write B+ tree with range queries, `at`, `rank` and O(1) `clone`), `SortedSet`, `SplayTree`, `Heap`, `Deque`, `LRUCache`, `Trie`, `FrozenSet`, and `bisect`, `bisectLeft`, `bisectRight`, `insort`, `insortLeft`, `binarySearch`. Each sorted structure takes an optional comparator (default rule 4). `Heap`, `Deque` and `FrozenSet` membership is SameValueZero. They follow the native `Map`/`Set` method names where the concept matches (`get`, `set`, `has`, `delete`, `clear`, `size`, `keys`, `values`, `entries`, `forEach`, `[Symbol.iterator]`). `Deque` is indexed like an array, so it follows Array's names instead: `push`, `pop`, `shift`, `unshift`, `at`, `set(index, value)`, `includes`, and `keys` gives indices; it has no `has` or `delete`. The shared base classes are internal.

## Repository

- One package: root `package.json` defines the npm name and exports; root `deno.json` defines the JSR name and exports. `src/<area>/` holds each subpath, `src/index.ts` exports everything from the root, and `tests/` mirrors `src/`.
- One Biome config, one `tsconfig.json` with `tsconfig.build.json` for the build, and one vitest config for `tests/**/*.spec.ts`.
- A GitHub release tagged `v<version>` publishes the package to npm with trusted publishing and to JSR.
- `atomic-fns` 1.x lives on the `1.x` branch.
