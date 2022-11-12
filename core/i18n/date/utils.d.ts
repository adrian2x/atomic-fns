import { Function } from '../../globals/index.js';
export declare type DateParts = {
    year?: number;
    month?: number;
    day?: number;
    weekday?: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
};
export declare type DateLike = number | string | Date | DateParts;
export declare function hasRelative(): boolean;
export declare function maybeArray(thing: any): any[];
export declare function bestBy(arr: Array<any>, by: Function, compare: Function<number>): any;
export declare function integerBetween(thing: number, bottom: number, top: number): boolean;
/**
 * Returns x % n but takes the sign of n instead of x
 * @param x
 * @param n
 * @returns {number}
 */
export declare function floorMod(x: number, n: number): number;
export declare function padStart(input: number, n?: number): any;
export declare function parseInteger(str: string): number;
export declare function parseFloating(str: string): number;
export declare function parseMilliseconds(str: string): number;
export declare function roundTo(number: number, digits: number, towardZero?: boolean): number;
/**
 * Converts the given date to a UTC timestamp.
 * @param {Date} date
 * @returns {number} The milliseconds between the specified date and the UTC Epoch date.
 */
export declare function dateUTC(date: Date): number;
/**
 * Returns the minimum (most distant past) of the given date values.
 * @template T
 * @param {Array<T>} dates
 * @returns {T} The smallest date of `dates`
 */
export declare function minDate<T>(...dates: Array<T>): T;
/**
 * Returns the maximum (most distant future) of the given date values.
 * @template T
 * @param {Array<T>} dates
 * @returns {T} The largest date of `dates`
 */
export declare function maxDate<T>(...dates: Array<T>): T;
/**
 * Returns `true` if the year is a leap year, otherwise `false`.
 * @param year The date year
 * @returns {boolean} `true` if is a leap year
 */
export declare function isLeapYear(year: number): boolean;
/**
 * Get the number of days in the given year.
 * @param year The date year
 * @returns {number} Number of days in year
 */
export declare function daysInYear(year: number): 366 | 365;
/**
 * Get the number of days in the given month and year.
 * @param year The date year
 * @param month The date month as a number between 1 and 12, inclusive.
 * @returns {number} Number of days in month
 */
export declare function daysInMonth(year: number, month: number): number;
export declare function objToLocalTS(obj: DateParts): number;
/**
 * Gets the number of weeks according to locale in the current moment's year.
 * @param {number} weekYear The the date year
 * @returns {number}
 */
export declare function weeksInYear(weekYear: number): 53 | 52;
export declare function untruncateYear(year: number): number;
export declare function parseZoneInfo(ts: number | Date, offsetFormat: any, locale: any, timeZone?: any): string;
export declare function signedOffset(offHourStr: string, offMinuteStr: string): number;
export declare function asNumber(value: any): number;
export declare function formatOffset(offset: number, format: 'short' | 'narrow' | 'techie'): string;
export declare function timeObject(obj: DateParts): {
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
};
export declare const ianaRegex: RegExp;
export declare function parseISODuration(s: any): any;
