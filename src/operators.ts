import { call, isNumber } from './globals.js'

export const id = (x) => x

export const bool = (x) => !!x

export const not = (x) => !x

export const isinstance = (x, y) => x instanceof y

export const all = (...args) => args.every((x) => bool(x))

export const any = (...args) => args.some((x) => bool(x))

export const and = (...args) => all(...args)

export const or = (...args) => any(...args)

export function comp(x, y) {
  let op = call('compare', x, y)
  if (isNumber(op)) return op
  op = le(x, y)
  if (op) return -1
  op = ge(x, y)
  if (op) return 1
  return 0
}

export function lt(x, y) {
  const op = call('lt', x, y)
  if (op != null) return op
  return x < y
}

export function le(x, y) {
  let op = call('le', x, y)
  if (op != null) return op
  op = call('eq', x, y)
  if (op === true) return op
  op = call('lt', x, y)
  if (op != null) return op
  return x <= y
}

export function eq(x, y) {
  const op = call('eq', x, y)
  if (op != null) return op
  return x === y
}

const ne = (x, y) => !eq(x, y)

export function gt(x, y) {
  const op = call('gt', x, y)
  if (op != null) return op
  return x > y
}

export function ge(x, y) {
  let op = call('ge', x, y)
  if (op != null) return op
  op = call('eq', x, y)
  if (op === true) return op
  op = call('gt', x, y)
  if (op != null) return op
  return x >= y
}

export function add(x, y) {
  const op = call('add', x, y)
  if (op != null) return op
  return x + y
}

export function sub(x, y) {
  const op = call('sub', x, y)
  if (op != null) return op
  return x - y
}

export function mult(x, y) {
  const op = call('mult', x, y)
  if (op != null) return op
  return x * y
}

export function div(x, y) {
  const op = call('div', x, y)
  if (op != null) return op
  return x / y
}

export function mod(x, y) {
  const op = call('mod', x, y)
  if (op != null) return op
  return x % y
}

/**
 * Calculates `x` to the power of `y`. If `x` implements a custom `pow` operator
 * it will return `x.pow(y)`.
 * @export
 * @param {*} x
 * @param {*} y
 * @return `x` raised to the power `y`
 */
export function pow(x, y) {
  const op = call('pow', x, y)
  if (op != null) return op
  return x ** y
}
