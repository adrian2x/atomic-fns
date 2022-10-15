import { call, isFunc } from './globals.js';
import { comp } from './operators.js';
export function abs(x) {
    const op = call(x, 'abs');
    if (op != null)
        return op;
    return Math.abs(x);
}
/**
 * Returns a tuple like (x / y, x % y)
 *
 * @param {number} x
 * @param {number} y
 * @return {number[]}
 */
export function divmod(x, y) {
    return [Math.floor(x / y), x % y];
}
export function log2(x) {
    if (x > 0) {
        return Math.log(x) * 1.442695;
    }
    return Number.NaN;
}
export function logBase(x, y) {
    if (x > 0 && y > 0) {
        return Math.log(y) / Math.log(x);
    }
    return Number.NaN;
}
/** First argument can be a comparer func */
export function min(args) {
    // Uses `le` by default
    let cmp = comp;
    if (isFunc(args[0])) {
        cmp = args.shift();
    }
    let res = args[0];
    for (const x of args) {
        if (cmp(x, res) === -1) {
            res = x;
        }
    }
    return res;
}
/** First argument can be a comparer func */
export function max(args) {
    // Uses ge by default
    let cmp = comp;
    if (isFunc(args[0])) {
        cmp = args.shift();
    }
    let res = args[0];
    for (const x of args) {
        if (cmp(x, res) === 1) {
            res = x;
        }
    }
    return res;
}
export function sum(args) {
    let total = 0;
    for (const x of args) {
        total += x;
    }
    return total;
}
