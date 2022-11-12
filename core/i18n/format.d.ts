/**
 * Returns a new Date from the given arguments.
 * @param {string | number | Date} date The date value
 * @param {?boolean} [utc=false] Interprets the given value as a UTC date
 * @returns {Date} The new date object
 */
export declare function getDate(date: string | number | Date, utc?: boolean): Date;
/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * @param {string} fmt The format string to apply
 * @param {number | Date} date The date value
 * @param {?string} locale The locale to use when formatting (default is system locale).
 * @returns {string} The string representation of date
 * @see {@link https://strftime.org/ strftime format}
 */
export declare function format(fmt: string, date: number | Date, locale?: any): string;
