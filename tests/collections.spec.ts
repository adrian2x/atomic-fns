import assert from 'assert'
import {
  binarySearch,
  bisect,
  bisectLeft,
  BTree,
  clone,
  compact,
  count,
  difference,
  filter,
  find,
  findLast,
  findLastIndex,
  flatten,
  forEach,
  FrozenSet,
  groupBy,
  insort,
  insortLeft,
  intersection,
  lastIndexOf,
  map,
  matches,
  merge,
  omit,
  pick,
  remove,
  sortedUniq,
  union,
  uniq
} from '../src/collections/index.js'

describe('collections', () => {
  it('compact', () => {
    let filtered = compact([0, 1, false, 2, '', 3])
    assert.deepEqual(filtered, [1, 2, 3])
    assert.deepEqual(compact({ a: 1, b: undefined, c: false, d: [] }), { a: 1 })
  })

  it('count', () => {
    let counters = count([0, 1, false, 2, '', 3], (x) => !!x)
    assert(counters['true'] === 3)
    assert(counters['false'] === 3)
    assert.deepEqual(
      count(['one', 'two', 'three'], (x) => x.length),
      { '3': 2, '5': 1 }
    )
  })

  it('copies keep a __proto__ key as data', () => {
    const source = JSON.parse('{"__proto__": {"admin": true}, "a": 1}')
    const copies = [
      clone(source),
      clone(source, true),
      compact(source),
      pick(source, () => true),
      omit(source, ['b']),
      omit(source, () => false)
    ]
    for (const copy of copies) {
      assert(Object.getPrototypeOf(copy) === Object.prototype)
      assert.deepEqual(Object.keys(copy), ['__proto__', 'a'])
    }
    assert(Object.getPrototypeOf(pick(source, ['__proto__'])) === Object.prototype)
  })

  it('count keeps keys with dots or inherited names', () => {
    const identity = (x) => x
    assert.deepEqual(count(['1.5', '1.5'], identity), { '1.5': 2 })
    assert.deepEqual(count(['constructor', 'constructor'], identity), { constructor: 2 })
    assert.deepEqual(count([1, '1'], identity), { '1': 2 })

    const counters = count(['__proto__', '__proto__'], identity)
    assert(Object.getPrototypeOf(counters) === Object.prototype)
    assert.deepEqual(Object.entries(counters), [['__proto__', 2]])
  })

  it('clone array', () => {
    let arr = [4, 7, 1, 9]
    assert.deepEqual(clone(arr), arr)
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('clone object', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('clone copies Date and RegExp', () => {
    const date = new Date(5)
    const dateCopy = clone(date)
    assert(dateCopy !== date)
    assert(dateCopy instanceof Date)
    assert(dateCopy.getTime() === 5)
    assert(clone({ date }, true).date.getTime() === 5)

    const regex = /a/gi
    regex.lastIndex = 3
    const regexCopy = clone(regex)
    assert(regexCopy !== regex)
    assert(regexCopy.source === 'a')
    assert(regexCopy.flags === 'gi')
    assert(regexCopy.lastIndex === 3)
  })

  it('clone copies an ArrayBuffer', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    const copy = clone(buffer)
    assert(copy !== buffer)
    assert.deepEqual([...new Uint8Array(copy)], [1, 2, 3])
    assert(clone(buffer, true).byteLength === 3)
  })

  it('clone and merge keep a DataView', () => {
    const view = new DataView(new Uint8Array([1, 2, 3, 4]).buffer, 1, 2)
    const shallow = clone(view)
    assert(shallow.buffer === view.buffer)
    assert(shallow.byteOffset === 1)
    assert(shallow.byteLength === 2)

    const deep = clone(view, true)
    assert(deep.buffer !== view.buffer)
    assert(deep.byteLength === 2)
    assert(deep.getUint8(0) === 2)

    const merged = merge({}, { view }) as { view: DataView }
    assert(merged.view !== view)
    assert(merged.view.getUint8(1) === 3)
  })

  it('clone calls a clone method on array-like objects', () => {
    const tree = new BTree([[1, 2]])
    assert(clone(tree) instanceof BTree)
    assert(clone(tree, true) instanceof BTree)
  })

  it('clone keeps a plain object with a length key', () => {
    assert.deepEqual(clone({ length: 10, width: 5 }), { length: 10, width: 5 })
    assert.deepEqual(clone({ length: 0, width: 5 }), { length: 0, width: 5 })
    assert.deepEqual(clone({ length: 2 ** 32 }), { length: 2 ** 32 })
  })

  it('clone turns a real array-like into an array', () => {
    const args = function (..._items) {
      // biome-ignore lint/complexity/noArguments: this spec needs a real arguments object
      return arguments
    }
    assert.deepEqual(clone(args(1, 2)), [1, 2])
    assert.deepEqual(clone(args()), [])
    assert.deepEqual(clone({ 0: 'a', 1: 'b', length: 2 }), ['a', 'b'])
  })

  it('clone deep keeps a cycle through objects', () => {
    const node = { name: 'a', self: null }
    node.self = node
    const copy = clone(node, true)
    assert(copy !== node)
    assert(copy.name === 'a')
    assert(copy.self === copy)
  })

  it('clone copies Map and Set', () => {
    const item = { a: 1 }
    const map = new Map([['key', item]])
    const set = new Set([item])

    const mapCopy = clone(map)
    assert(mapCopy !== map)
    assert(mapCopy.get('key') === item)
    const setCopy = clone(set)
    assert(setCopy !== set)
    assert(setCopy.has(item))

    const deepMap = clone(map, true)
    assert(deepMap.get('key') !== item)
    assert.deepEqual(deepMap.get('key'), item)
    const [deepItem] = clone(set, true)
    assert(deepItem !== item)
    assert.deepEqual(deepItem, item)

    const key = {}
    assert(clone(new Map([[key, 1]]), true).has(key))
  })

  it('clone deep keeps a cycle through Map and Set', () => {
    const map = new Map()
    map.set('self', map)
    const mapCopy = clone(map, true)
    assert(mapCopy !== map)
    assert(mapCopy.get('self') === mapCopy)

    const set = new Set()
    set.add(set)
    const setCopy = clone(set, true)
    assert(setCopy !== set)
    assert(setCopy.has(setCopy))
  })

  it('clone keeps Map and Set subclasses by reference', () => {
    class Registry extends Map {
      lookup() {
        return 1
      }
    }
    const registry = new Registry()
    assert(clone(registry).lookup() === 1)
    const frozen = new FrozenSet([1])
    assert(clone(frozen) === frozen)
  })

  it('clone deep accepts functions and symbols in arrays', () => {
    const fn = () => 1
    const symbol = Symbol('s')
    const inner = { fn, list: [1] }
    const copy = clone([fn, symbol, inner], true) as [typeof fn, symbol, typeof inner]
    assert(copy[0] === fn)
    assert(copy[1] === symbol)
    assert(copy[2] !== inner)
    assert(copy[2].fn === fn)
    assert(copy[2].list !== inner.list)

    const cyclic: unknown[] = [fn]
    cyclic.push(cyclic)
    const cycleCopy = clone(cyclic, true)
    assert(cycleCopy !== cyclic)
    assert(cycleCopy[1] === cycleCopy)
  })

  it('clone deep still uses structuredClone for arrays it accepts', () => {
    const item = {}
    const copy = clone([item, item, new Date(0)], true)
    assert(copy[0] === copy[1])
    assert(copy[2] instanceof Date)
  })

  it('difference', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual(sortedUniq(difference(a, b)), [1, 2])
    assert.deepEqual([...difference([2, 1], [2, 3])], [1])
    assert.deepEqual([...difference([1, 2, 3], [2], [2, 3])], [1])
  })

  it('difference with no arguments is empty', () => {
    assert.deepEqual([...difference()], [])
  })

  it('intersection', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual([...intersection(a, b)], [5])
  })

  it('union', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual(sortedUniq(union(a, b)), [1, 2, 3, 4, 5])
  })

  it('uniq and union treat null and undefined as empty', () => {
    assert.deepEqual(uniq(null), [])
    assert.deepEqual(sortedUniq(undefined), [])
    assert.deepEqual([...union(null, [1], undefined)], [1])
  })

  it('filter', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(
      filter(users, (o) => o.active),
      [users[0]]
    )
  })

  it('filter matches', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, { age: 36 }), [users[0]])
  })

  it('filter property', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, 'active'), [users[0]])
  })

  it('matches compares nested objects and arrays', () => {
    assert(matches({ a: { b: 1 } })({ a: { b: 1 } }))
    assert(matches({ a: { b: 1 } })({ a: { b: 1, c: 2 } }))
    assert(matches({ a: [1, { b: 2 }] })({ a: [1, { b: 2, c: 3 }], d: 4 }))
    assert(matches({ a: {} })({ a: { b: 1 } }))
    assert(matches({ a: [] })({ a: [1] }))

    assert(!matches({ a: { b: 1 } })({ a: { b: 2 } }))
    assert(!matches({ a: { b: 1 } })({ a: 1 }))
    assert(!matches({ a: { b: 1 } })({ a: null }))
    assert(!matches({ a: { b: 1 } })({}))
    assert(!matches({ a: [1] })({ a: { 0: 1 } }))
    assert(!matches({ a: {} })({ a: [] }))
    assert(!matches({ date: new Date(0) })({ date: new Date(1) }))

    const users = [{ address: { city: 'a' } }, { address: { city: 'b' } }]
    assert.deepEqual(filter(users, { address: { city: 'b' } }), [users[1]])
    assert(find(users, { address: { city: 'b' } }) === users[1])
  })

  it('matches finishes on cycles and shared objects', () => {
    const shape = { a: 1, self: null }
    shape.self = shape
    const value = { a: 1, self: null }
    value.self = value
    assert(matches(shape)(value))
    value.a = 2
    assert(!matches(shape)(value))

    let wide = {}
    let other = {}
    for (let i = 0; i < 40; i++) {
      wide = { a: wide, b: wide }
      other = { a: other, b: other }
    }
    assert(matches(wide)(other))
  })

  it('find', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, (o) => o.active) === users[0])
  })

  it('find matches', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, { age: 40 }) === users[1])
  })

  it('find Object', () => {
    let users = {
      '0': { user: 'barney', age: 36, active: true },
      '1': { user: 'fred', age: 40, active: false }
    }
    assert(find(users, { active: false }) === users['1'])
  })

  it('findLast', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findLast(users, { age: 36 }) === users[2])
  })

  it('findLast matches', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findLast(users, { age: 36 }) === users[2])
  })

  it('findLast accepts a property name', () => {
    const users = [
      { user: 'barney', active: true },
      { user: 'fred', active: false },
      { user: 'pebbles', active: true }
    ]
    assert(findLast(users, 'active') === users[2])
  })

  it('forEach', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    let result = [] as any
    forEach(users, (value, key) => result.push([key, value]))
    assert.deepEqual(
      result,
      users.map((x, i) => [i, x])
    )
  })

  it('forEach object key', () => {
    let target = { user: 'fred', age: 40, active: false }
    let objs = [] as any[]
    forEach(target, (value, key) => objs.push([key, value]))
    assert.deepEqual(objs, Object.entries(target))
  })

  it('flatten Array', () => {
    let data = flatten([1, 2, [3, 4], 5])
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flatten Array deep', () => {
    let data = flatten([1, 2, [3, [4]], [5]], true)
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flatten Object', () => {
    const data = {
      dates: {
        expiry_date: '30 sep 2018',
        available: '30 sep 2017',
        min_contract_period: [
          {
            id: 1,
            name: '1 month'
          }
        ]
      },
      price: {
        currency: 'RM',
        value: 1500
      }
    }
    assert.deepEqual(flatten(data), {
      'dates.expiry_date': '30 sep 2018',
      'dates.available': '30 sep 2017',
      'dates.min_contract_period[0].id': 1,
      'dates.min_contract_period[0].name': '1 month',
      'price.currency': 'RM',
      'price.value': 1500
    })
  })

  it('groupBy', () => {
    assert.deepEqual(groupBy([6.1, 4.2, 6.3], Math.floor), { '4': [4.2], '6': [6.1, 6.3] })
  })

  it('groupBy accepts keys named after inherited properties', () => {
    const identity = (x) => x
    assert.deepEqual(groupBy(['constructor', 'toString'], identity), {
      constructor: ['constructor'],
      toString: ['toString']
    })

    const groups = groupBy(['__proto__', '__proto__'], identity)
    assert(Object.getPrototypeOf(groups) === Object.prototype)
    assert.deepEqual(Object.entries(groups), [['__proto__', ['__proto__', '__proto__']]])

    const coerced = groupBy([1], () => ['__proto__'])
    assert(Object.getPrototypeOf(coerced) === Object.prototype)
    assert.deepEqual(Object.entries(coerced), [['__proto__', [1]]])
  })

  it('map', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    const square = (x) => x * x
    assert.deepEqual(map([4, 8], square), [16, 64])
    assert.deepEqual(map({ a: 4, b: 8 }, square), [16, 64])
    assert.deepEqual(map(users, 'user'), ['barney', 'fred'])
  })

  it('merge', () => {
    let object = {
      a: [{ b: 2 }, { d: 4 }]
    }
    let other = {
      a: [{ c: 3 }, { e: 5 }],
      foo: null,
      bar: true,
      noop: undefined
    }
    assert.deepEqual(merge(object, other), {
      a: [
        { b: 2, c: 3 },
        { d: 4, e: 5 }
      ],
      foo: null,
      bar: true
    })
  })

  it('merge skips __proto__ keys', () => {
    try {
      merge({}, JSON.parse('{"__proto__": {"polluted": 1}}'))
      merge({ a: {} }, JSON.parse('{"a": {"__proto__": {"polluted": 1}}}'))
      assert(!('polluted' in {}))
    } finally {
      Reflect.deleteProperty(Object.prototype, 'polluted')
    }
    assert(Object.getPrototypeOf(merge({}, JSON.parse('{"__proto__": null}'))) === Object.prototype)
    assert(Object.getPrototypeOf(merge({}, JSON.parse('{"__proto__": [1]}'))) === Object.prototype)
    assert.deepEqual(Object.keys(merge({}, JSON.parse('{"__proto__": 1, "a": 2}'))), ['a'])
  })

  it('merge keeps a constructor key as data', () => {
    const merged = merge({}, JSON.parse('{"constructor": {"prototype": {"polluted": 1}}}'))
    assert(!('polluted' in {}))
    assert.deepEqual(Object.keys(merged), ['constructor'])
  })

  it('merge assigns Map, Set and other objects it cannot merge', () => {
    const source = { map: new Map([['a', 1]]), set: new Set([1]), error: new Error('x') }
    assert.deepStrictEqual(merge({}, source), source)
    assert.deepStrictEqual(merge({ map: 1, set: 2, error: 3 }, source), source)
  })

  it('merge skips null and undefined sources', () => {
    assert.deepEqual(merge({ a: 1 }, null, undefined, { b: 2 }), { a: 1, b: 2 })
  })

  it('merge keeps a value when the source has undefined', () => {
    assert.deepEqual(merge({ a: 1 }, { a: undefined }), { a: 1 })
    assert.deepEqual(merge({ a: { b: 1 } }, { a: { b: undefined } }), { a: { b: 1 } })
    assert.deepEqual(merge({ a: [1, 2] }, { a: [undefined, 3] }), { a: [1, 3] })
  })

  it('merge handles a cycle the target already has', () => {
    const source = { a: [] as unknown[] }
    source.a.push(source.a)
    const target: { a?: unknown[] } = {}
    merge(target, source)
    merge(target, source)
    assert(target.a[0] === target.a)

    const cyclic = { a: { self: null } }
    cyclic.a.self = cyclic.a
    const other = { a: { self: null } }
    other.a.self = other.a
    merge(other, cyclic)
    assert(other.a.self === other.a)
  })

  it('merge copies plain objects from sources', () => {
    const source = { a: { b: 1 }, list: [{ c: 1 }] }
    const merged = merge({}, source) as typeof source
    merged.a.b = 2
    merged.list[0].c = 2
    assert.deepEqual(source, { a: { b: 1 }, list: [{ c: 1 }] })

    const first = { options: { a: 1 } }
    merge({}, first, { options: { b: 2 } })
    assert.deepEqual(first, { options: { a: 1 } })

    const cyclic = { a: { self: null } }
    cyclic.a.self = cyclic.a
    const copy = merge({}, cyclic) as typeof cyclic
    assert(copy.a !== cyclic.a)
    assert(copy.a.self === copy.a)
  })

  it('merge assigns a Date or class instance by reference', () => {
    class Point {
      x = 1
    }
    const source = { date: new Date(0), point: new Point() }
    const merged = merge({}, source) as typeof source
    assert(merged.date === source.date)
    assert(merged.point === source.point)
  })

  it('merge assigns objects that are not plain over existing values', () => {
    class Point {
      x = 1
    }
    const source = { date: new Date(0), regex: /b/, point: new Point() }
    const target = { date: new Date(1), regex: /a/, point: { y: 1 } }
    const merged = merge(target, source) as typeof source
    assert(merged.date === source.date)
    assert(merged.regex === source.regex)
    assert(merged.point === source.point)
    const overObject = merge({ date: { x: 1 } }, source) as typeof source
    assert(overObject.date === source.date)
  })

  it('pick', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(pick(target, ['user']), { user: 'fred' })
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('pickBy', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('omit', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(omit(target, ['age', 'active']), { user: 'fred' })
  })

  it('omitBy', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(
      omit(target, (x) => !x),
      { user: 'fred', age: 40 }
    )
  })

  it('remove', () => {
    assert.deepEqual(remove([1, 2, 3, 4], 1), [2, 3, 4])
    assert.deepEqual(remove([1, 2, 3, 4], [3, 4]), [1, 2])
  })

  it('removeBy', () => {
    assert.deepEqual(
      remove([1, 2, 3, 4], (x) => x % 2 === 0),
      [1, 3]
    )
  })

  it('lastIndexOf searches from the end by default', () => {
    assert(lastIndexOf([1, 2, 1, 2], 2) === 3)
    assert(lastIndexOf([1, 2, 1, 2], 2, 2) === 1)
    assert(lastIndexOf(new Uint8Array([1, 2, 1]), 1) === 2)
    assert(lastIndexOf('abca', 'a') === 3)
  })

  it('findLastIndex and lastIndexOf clamp a start past the end', () => {
    let calls = 0
    const bounded = () => {
      calls++
      assert(calls < 10)
      return false
    }
    assert(findLastIndex([1, 2], bounded, Infinity) === -1)
    assert(findLastIndex([{ a: 1 }], (x) => x.a === 1, 5) === 0)
    assert(findLastIndex([1], (x) => x === undefined, 5) === -1)

    let reads = 0
    const arrayLike = {
      length: 1,
      0: 1,
      get Infinity() {
        reads++
        assert(reads < 10)
        return undefined
      }
    }
    assert(lastIndexOf(arrayLike, 2, Infinity) === -1)
    assert(lastIndexOf({ length: 1, 0: 1 }, undefined, 5) === -1)
  })

  it('sortedUniq', () => {
    let arr = [4, 7, 1, 9, 1, 7, 4]
    let sort = sortedUniq(arr)
    assert.deepEqual(sort, [1, 4, 7, 9])
  })

  it('uniq', () => {
    let arr = [4, 7, 1, 1, 9, 4, 7]
    let distinct = uniq(arr)
    assert.deepEqual(distinct, [4, 7, 1, 9])
  })

  it('uniqBy', () => {
    let arr = [4, 7, 1, 1, 9, 4, 7]
    let distinct = uniq(arr, (x) => x * 2)
    assert.deepEqual(distinct, [4, 7, 1, 9])
    assert.deepEqual(uniq([2.1, 1.2, 2.3], Math.floor), [2.1, 1.2])
    const first = { a: 1, b: 1 }
    assert.deepEqual(uniq([first, { a: 1, b: 2 }], 'a'), [first])
    assert.deepEqual(sortedUniq([2.3, 1.2, 2.1], Math.floor), [1.2, 2.3])
    assert(Object.is(uniq([-0])[0], 0))
  })

  it('binarySearch', () => {
    let arr = [1, 1, 4, 4, 7, 7, 9]
    assert(binarySearch(arr, 1) === 1)
    assert(binarySearch(arr, 4) === 3)
    assert(binarySearch(arr, 7) === 5)
    assert(binarySearch(arr, 9) === 6)
  })

  it('binarySearch encodes the insertion point', () => {
    assert(binarySearch([1, 3, 5], 6) === -4)
    assert(binarySearch([1, 3, 5], 2) === -2)
    assert(binarySearch([1], 2) === -2)
    assert(binarySearch([], 1) === -1)
    assert(binarySearch([], undefined) === -1)
    for (let size = 0; size < 8; size++) {
      const arr = Array.from({ length: size }, (_, i) => i * 2)
      for (let x = -1; x <= size * 2; x++) {
        const result = binarySearch(arr, x)
        if (arr.includes(x)) assert(arr[result] === x)
        else assert(-result - 1 === arr.filter((y) => y < x).length)
      }
    }
  })

  it('bisect', () => {
    assert(bisect([1], 2) === 1)
    let arr = [1, 1, 4, 4, 7, 7, 9]
    assert(bisect(arr, 1) === 2)
    assert(bisect(arr, 4) === 4)
    assert(bisect(arr, 7) === 6)
    assert(bisect(arr, 9) === 7)
  })

  it('bisect finds the insertion point between elements', () => {
    assert(bisect([1, 3, 5], 2) === 1)
    assert(bisectLeft([1, 3, 5], 2) === 1)
    assert.deepEqual(insort([1, 3, 5], 2), [1, 2, 3, 5])
    assert.deepEqual(insortLeft([1, 3, 5], 2), [1, 2, 3, 5])
    for (let size = 0; size < 8; size++) {
      const arr = Array.from({ length: size }, (_, i) => Math.floor(i / 2) * 2)
      for (let x = -1; x <= size + 1; x++) {
        assert(bisect(arr, x) === arr.filter((y) => y <= x).length)
        assert(bisectLeft(arr, x) === arr.filter((y) => y < x).length)
      }
    }
  })

  it('insort', () => {
    assert.deepEqual(insort([1], 2), [1, 2])
    assert.deepEqual(insort([1, 1, 4, 4, 7, 7, 9], 5), [1, 1, 4, 4, 5, 7, 7, 9])
    assert.deepEqual(insort([1, 1, 4, 4, 7, 7, 9], 10), [1, 1, 4, 4, 7, 7, 9, 10])
  })

  it('bisectLeft', () => {
    assert(bisectLeft([1], 2) === 1)
    let arr = [1, 1, 4, 4, 7, 7, 9]
    assert(bisectLeft(arr, 1) === 0)
    assert(bisectLeft(arr, 4) === 2)
    assert(bisectLeft(arr, 7) === 4)
    assert(bisectLeft(arr, 9) === 6)
  })

  it('insortLeft', () => {
    assert.deepEqual(insortLeft([1], 2), [1, 2])
    assert.deepEqual(insortLeft([1, 1, 4, 4, 7, 7, 9], 5), [1, 1, 4, 4, 5, 7, 7, 9])
    assert.deepEqual(insortLeft([1, 1, 4, 4, 7, 7, 9], 10), [1, 1, 4, 4, 7, 7, 9, 10])
  })
  it('merge copies a shared source object once', () => {
    let shared: any = { leaf: 1 }
    for (let i = 0; i < 20; i++) shared = { a: shared, b: shared }
    const result: any = merge({}, { root: shared })
    assert(result.root !== shared)
    assert(result.root.a === result.root.b)

    const part = { r: 3 }
    assert.deepEqual(merge({ a: { p: 1 }, b: { q: 2 } }, { a: part, b: part }), {
      a: { p: 1, r: 3 },
      b: { q: 2, r: 3 }
    })
  })
  it('merge walks a shared source object once per target', () => {
    let reads = 0
    let shared: any = {
      get leaf() {
        reads++
        return 1
      }
    }
    for (let i = 0; i < 12; i++) shared = { a: shared, b: shared }
    merge({}, { root: shared }, { root: shared })
    assert(reads === 2)
  })

  it('sortedUniq sorts by the iteratee', () => {
    assert.deepEqual(sortedUniq([{ id: 2 }, { id: 1 }, { id: 2 }], 'id'), [{ id: 1 }, { id: 2 }])
    assert.deepEqual(sortedUniq([3.2, 1.1, 3.9], Math.floor), [1.1, 3.2])
  })
})
