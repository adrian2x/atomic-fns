/**
 * This module includes functions that deal with or produce iterators.
 *
 * @module Iterators
 */
import { Comp, Function } from '../globals/index.js';
export declare function iter(obj: any): Iterator<any>;
export declare function range(...args: number[]): Generator<number, void, unknown>;
/** Creates a new list with the elements from the iterable in reverse order. */
export declare function reversed(iterable: Iterable<any>): any[];
export declare function sorted(args: any[]): any[];
export declare function sorted(args: any[], reverse: boolean): any[];
export declare function sorted(args: any[], reverse: boolean, comp: Comp): any[];
export declare function sorted(args: any[], key: Function): any[];
export declare function sorted(args: any[], key: Function, reverse: boolean): any[];
export declare function sort(args: any[]): any[];
export declare function sort(args: any[], reverse: boolean): any[];
export declare function sort(args: any[], compareFn: Comp): any[];
export declare function sort(args: any[], reverse: boolean, compareFn: Comp): any[];
/** Returns a generator that calls `fn(index)` for each index < n */
export declare function times(n: number, fn: (index: number) => any): Generator<any, void, unknown>;
export declare function zip(...args: any[]): Generator<any, void, unknown>;
