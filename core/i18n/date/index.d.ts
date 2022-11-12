import { Duration, DurationUnit, TDuration } from '../duration.js';
import { DateLike, DateParts, daysInMonth, daysInYear, isLeapYear, maxDate, minDate, weeksInYear } from './utils.js';
export { daysInMonth, daysInYear, isLeapYear, maxDate, minDate, weeksInYear };
/**
 * Creates a date tied to a given locale (default system locale) which can be formatted in that locale's language using the native {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis} directly or using a formatting string compatible with `strftime`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis}
 * @see {@link https://strftime.org/ strftime format}
 */
export declare class IntlDate {
    private self;
    readonly locale?: string;
    intlRelativeFormat: Intl.RelativeTimeFormat;
    /** Returns the current UTC date and time. */
    static UTC(obj?: DateLike): IntlDate;
    /** Returns the current local date and time.*/
    static now(): IntlDate;
    /**
     * Creates a new `IntlDate` tied to the specified locale (default is system locale).
     * **Note:** The allowed values for `month` start at 1, which is different from legacy `Date`
     * @param {DateLike | IntlDate} obj The date value (default is now)
     * @param {{locale?: string, utc?: boolean}} opts
     * @returns
     */
    constructor(obj?: DateLike | IntlDate, { locale, utc }?: any);
    /** Get the this date's year. */
    get year(): number;
    /** Returns the weekday as a number between 1 and 7, inclusive, where Monday is 1 and Sunday is 7. */
    get dayOfWeek(): number;
    /** Get the this date's current day of the month. */
    get day(): number;
    /** Get the this date's current hour. */
    get hour(): number;
    /** Get the this date's current minute. */
    get minute(): number;
    /** Get the this date's current second. */
    get second(): number;
    /** Get the this date's current millisecond. */
    get millisecond(): number;
    isValid(): boolean;
    /** Get the this date's month as a number from 1 to 12, inclusive. */
    get month(): number;
    /** Get the number of days in this date's month. */
    daysInMonth(): number;
    /** Get the number of days in this date's year. */
    daysInYear(): 366 | 365;
    /** Returns `true` if this date's year is a leap year. */
    isLeapYear(): boolean;
    /** Gets the number of weeks according to locale in the current moment's year. */
    weeksInYear(): 53 | 52;
    /**
     * Returns a localized string representation of this date.
     * @param {Intl.DateTimeFormatOptions} opts The options to use for the format
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat Intl.DateTimeFormat()}
     */
    toString(opts?: Intl.DateTimeFormatOptions): string;
    /**
     * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as C / Python's strftime().
     * @param {string} str The format string to use
     * @see {@link https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes Format Codes}
     * @example
  ```js
  new IntlDate().format('%m/%d/%y') // '10/31/2022'
  ```
     */
    format(str: string): string;
    /**
     * Returns a new copy of the native `Date` object used by this instance.
     * @returns {Date} A new `Date` object
     */
    toDate(): Date;
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.timestamp}
     * @see {@link IntlDate.unix}
     * @example
  ```js
  new IntlDate().toSeconds() // 1318874398
  ```
     */
    toSeconds(): number;
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.toSeconds}
     * @see {@link IntlDate.unix}
     * @example
  ```js
  new IntlDate().timestamp() // 1318874398
  ```
     */
    timestamp(): number;
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.toSeconds}
     * @see {@link IntlDate.timestamp}
     * @example
  ```js
  new IntlDate().unix() // 1318874398
  ```
     */
    unix(): number;
    /** Formats a string to the ISO8601 standard.
     * @example
  ```js
  new IntlDate().toISOString() // '2022-10-31T22:44:30.652Z'
  ```
     */
    toISOString(): string;
    /** Returns the date part formatted as ISO8601.
     * @example
  ```js
  new IntlDate().toISODate() // '2022-10-31'
  ```
     */
    toISODate(): string;
    /** Returns the time part formatted as ISO8601.
     * @example
  ```js
  new IntlDate().toISOTime() // 'T22:44:30.652Z'
  ```
     */
    toISOTime(): string;
    /**
     * Returns an object containing year, month, day-of-month, hours, minutes, seconds, milliseconds.
     * @returns {Object} An object like `{year, month, date, hours, minutes, seconds, ms}`
     */
    toObject(): DateParts;
    /** Returns the number of milliseconds since the Unix Epoch (January 1, 1970 UTC)  */
    getTime(): number;
    /** Alias of {@link IntlDate.getTime}  */
    valueOf(): number;
    /** Returns the timezone string name  */
    zoneName(): string;
    /** Returns the timezone GMT offset  */
    offset(): string;
    /** Returns the difference in minutes between this date and UTC  */
    offsetInMinutes(): number;
    /**
     * Check if this date is before another date. The other value will be parsed as an `IntlDate` if not already so.
     * @param {string | number | Object | Date | IntlDate} other Another date or date like object
     * @returns {boolean} Returns `true` if this date is before the given value
     */
    isBefore(other: DateLike | IntlDate): boolean;
    /**
     * Check if this date is strictly after the given `start` and before `stop` dates. The values will be parsed as an `IntlDate` if not already so.
     * @param {string | number | Object | Date | IntlDate} start The smaller date
     * @param {string | number | Object | Date | IntlDate} stop The larger date
     * @returns {boolean} Returns `true` if this date is greater than `start` and less than `stop`.
     */
    isBetween(start: DateLike | IntlDate, stop: DateLike | IntlDate): boolean;
    /**
     * Check if this date is after another date. The other value will be parsed as an `IntlDate` if not already so.
     * @param {string | number | DateParts | Date | IntlDate} other Another date or date like object
     * @returns {boolean} Returns `true` if this date is after the given value
     */
    isAfter(other: DateLike | IntlDate): boolean;
    /**
     * Check if this date is the same as `other`.
     * @param other Another date object
     * @returns {boolean} Returns `true` if this date is the same as other
     */
    isSame(other: Date | IntlDate): boolean;
    lt(other: Date | IntlDate): boolean;
    eq(other: Date | IntlDate): boolean;
    compare(other: Date | IntlDate): number;
    set(values: DateParts): IntlDate;
    get relativeFormat(): Intl.RelativeTimeFormat;
    relativeTime(n: number, unit?: Intl.RelativeTimeFormatUnit): string;
    fromNow(unit?: Intl.RelativeTimeFormatUnit): string;
    from(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string;
    toNow(unit?: Intl.RelativeTimeFormatUnit): string;
    to(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string;
    diff(other: DateLike, unit?: DurationUnit, exact?: boolean): number;
    add(duration: TDuration, exact?: boolean): IntlDate;
    subtract(duration: TDuration, exact?: boolean): IntlDate;
    startOf(unit: DurationUnit): IntlDate;
    endOf(unit: DurationUnit): IntlDate;
    clone(date?: DateLike): IntlDate;
}
export declare function addDuration(date: string | number | Date, duration: number | TDuration | Duration, exact?: boolean): Date;
export declare function subtract(date: string | number | Date, duration: TDuration, exact?: boolean): Date;
