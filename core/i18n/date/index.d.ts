export declare type DateParts = {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
};
declare type DateLike = number | string | Date | DateParts;
/**
 * Creates a date tied to a given locale (default system locale) which can be formatted in that locale's language using the native {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis} directly or using a formatting string compatible with `strftime`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis}
 * @see {@link https://strftime.org/ strftime format}
 */
export declare class IntlDate {
    private self;
    readonly year: number;
    readonly M: number;
    readonly day: number;
    readonly weekDay: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly millisecond: number;
    readonly locale: string;
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
    isValid(): boolean;
    /** Get the this date's month as a number from 1-12. */
    get month(): number;
    /** Get the number of days in this date's month. */
    daysInMonth(): number | null;
    /** Get the number of days in this date's year. */
    daysInYear(): 366 | 365;
    /** Returns `true` if this date's year is a leap year, otherwise `false`. */
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
     * Returns the timestamp representing the UTC equivalent of this date.
     * @returns {number} The UTC timestamp of this date.
     */
    toUTC(): number;
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
    valueOf(): number;
    /** Returns the timezone string name  */
    zoneName(): string;
    /** Returns the timezone GMT offset name  */
    offset(): string;
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
    /**
     * Returns the minimum (most distant past) of the given date values.
     * @param {Array<Date | IntlDate>} dates
     * @returns {Date | IntlDate} The smallest date of `dates`
     * @see {@link minDate}
     */
    static min(...dates: Array<Date | IntlDate>): Date | IntlDate;
    /**
     * Returns the maximum (most distant future) of the given date values.
     * @param {Array<Date | IntlDate>} dates
     * @returns {Date | IntlDate} The largest date of `dates`
     * @see {@link maxDate}
     */
    static max(...dates: Array<Date | IntlDate>): Date | IntlDate;
    lt(other: Date | IntlDate): boolean;
    eq(other: Date | IntlDate): boolean;
    compare(other: Date | IntlDate): 0 | 1 | -1;
}
/**
 * Converts the given date to a UTC timestamp.
 * @param {Date} date
 * @returns {number} The milliseconds between the specified date and the UTC Epoch date.
 */
export declare function dateToUTC(date: Date): number;
/**
 * Returns the minimum (most distant past) of the given date values.
 * @param {Array<Date | IntlDate>} dates
 * @returns {Date | IntlDate} The smallest date of `dates`
 */
export declare function minDate(...dates: Array<Date | IntlDate>): Date | IntlDate;
/**
 * Returns the maximum (most distant future) of the given date values.
 * @param {Array<Date | IntlDate>} dates
 * @returns {Date | IntlDate} The largest date of `dates`
 */
export declare function maxDate(...dates: Array<Date | IntlDate>): Date | IntlDate;
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
 * @param month The date month
 * @returns {number} Number of days in month
 */
export declare function daysInMonth(year: number, month: number): number | null;
/**
 * Gets the number of weeks according to locale in the current moment's year.
 * @param {number} weekYear The the date year
 * @returns {number}
 */
export declare function weeksInYear(weekYear: number): 53 | 52;
export {};
