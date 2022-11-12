import { isObject, ValueError } from '../../globals/index.js';
import { Duration, UNITS_PLURAL } from '../duration.js';
import { format, getDate } from '../format.js';
import { asNumber, daysInMonth, daysInYear, isLeapYear, maxDate, minDate, weeksInYear } from './utils.js';
export { daysInMonth, daysInYear, isLeapYear, maxDate, minDate, weeksInYear };
const INVALID_DATE_STRING = 'Invalid Date';
/**
 * Creates a date tied to a given locale (default system locale) which can be formatted in that locale's language using the native {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis} directly or using a formatting string compatible with `strftime`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis}
 * @see {@link https://strftime.org/ strftime format}
 */
export class IntlDate {
    self;
    locale;
    intlRelativeFormat;
    /** Returns the current UTC date and time. */
    static UTC(obj = {}) {
        return new IntlDate(obj, { utc: true });
    }
    /** Returns the current local date and time.*/
    static now() {
        return new IntlDate();
    }
    /**
     * Creates a new `IntlDate` tied to the specified locale (default is system locale).
     * **Note:** The allowed values for `month` start at 1, which is different from legacy `Date`
     * @param {DateLike | IntlDate} obj The date value (default is now)
     * @param {{locale?: string, utc?: boolean}} opts
     * @returns
     */
    constructor(obj, { locale, utc } = {}) {
        if (obj instanceof IntlDate)
            obj = obj.self;
        this.locale = locale;
        if (typeof obj === 'string' || typeof obj === 'number' || obj instanceof Date) {
            this.self = getDate(obj, utc);
        }
        else if (isObject(obj)) {
            let { year, month, day, hour, minute, second, millisecond } = obj;
            // NOTE month is from 1-12, not from 0-11
            if (typeof month === 'number') {
                month -= 1;
            }
            if (utc) {
                // from UTC to current
                this.self = new Date(Date.UTC(year, month, day || 1, hour || 0, minute || 0, second || 0, millisecond || 0));
            }
            else {
                this.self = new Date(year, month, day || 1, hour || 0, minute || 0, second || 0, millisecond || 0);
            }
        }
        else {
            this.self = new Date();
        }
        return this;
    }
    /** Get the this date's year. */
    get year() {
        return this.self.getFullYear();
    }
    /** Returns the weekday as a number between 1 and 7, inclusive, where Monday is 1 and Sunday is 7. */
    get dayOfWeek() {
        if (this.self.getDay() === 0)
            return 7;
        return this.self.getDay();
    }
    /** Get the this date's current day of the month. */
    get day() {
        return this.self.getDate();
    }
    /** Get the this date's current hour. */
    get hour() {
        return this.self.getHours();
    }
    /** Get the this date's current minute. */
    get minute() {
        return this.self.getMinutes();
    }
    /** Get the this date's current second. */
    get second() {
        return this.self.getSeconds();
    }
    /** Get the this date's current millisecond. */
    get millisecond() {
        return this.self.getMilliseconds();
    }
    isValid() {
        return this.self.toString() !== INVALID_DATE_STRING;
    }
    /** Get the this date's month as a number from 1 to 12, inclusive. */
    get month() {
        return this.self.getMonth() + 1;
    }
    /** Get the number of days in this date's month. */
    daysInMonth() {
        return daysInMonth(this.year, this.month);
    }
    /** Get the number of days in this date's year. */
    daysInYear() {
        return daysInYear(this.year);
    }
    /** Returns `true` if this date's year is a leap year. */
    isLeapYear() {
        return isLeapYear(this.year);
    }
    /** Gets the number of weeks according to locale in the current moment's year. */
    weeksInYear() {
        return weeksInYear(this.year);
    }
    /**
     * Returns a localized string representation of this date.
     * @param {Intl.DateTimeFormatOptions} opts The options to use for the format
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat Intl.DateTimeFormat()}
     */
    toString(opts) {
        return this.self.toLocaleDateString(this.locale, opts);
    }
    /**
     * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as C / Python's strftime().
     * @param {string} str The format string to use
     * @see {@link https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes Format Codes}
     * @example
  ```js
  new IntlDate().format('%m/%d/%y') // '10/31/2022'
  ```
     */
    format(str) {
        return format(str, this.self, this.locale);
    }
    /**
     * Returns a new copy of the native `Date` object used by this instance.
     * @returns {Date} A new `Date` object
     */
    toDate() {
        return new Date(this.isValid() ? this.self : NaN);
    }
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.timestamp}
     * @see {@link IntlDate.unix}
     * @example
  ```js
  new IntlDate().toSeconds() // 1318874398
  ```
     */
    toSeconds() {
        return Math.trunc(this.getTime() / 1000);
    }
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.toSeconds}
     * @see {@link IntlDate.unix}
     * @example
  ```js
  new IntlDate().timestamp() // 1318874398
  ```
     */
    timestamp() {
        return this.toSeconds();
    }
    /**
     * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
     * @see {@link IntlDate.toSeconds}
     * @see {@link IntlDate.timestamp}
     * @example
  ```js
  new IntlDate().unix() // 1318874398
  ```
     */
    unix() {
        return this.toSeconds();
    }
    /** Formats a string to the ISO8601 standard.
     * @example
  ```js
  new IntlDate().toISOString() // '2022-10-31T22:44:30.652Z'
  ```
     */
    toISOString() {
        return this.self.toISOString();
    }
    /** Returns the date part formatted as ISO8601.
     * @example
  ```js
  new IntlDate().toISODate() // '2022-10-31'
  ```
     */
    toISODate() {
        return this.self.toISOString().slice(0, 10);
    }
    /** Returns the time part formatted as ISO8601.
     * @example
  ```js
  new IntlDate().toISOTime() // 'T22:44:30.652Z'
  ```
     */
    toISOTime() {
        return this.self.toISOString().slice(11);
    }
    /**
     * Returns an object containing year, month, day-of-month, hours, minutes, seconds, milliseconds.
     * @returns {Object} An object like `{year, month, date, hours, minutes, seconds, ms}`
     */
    toObject() {
        return {
            year: this.year,
            month: this.month,
            day: this.day,
            hour: this.hour,
            minute: this.minute,
            second: this.second,
            millisecond: this.millisecond
        };
    }
    /** Returns the number of milliseconds since the Unix Epoch (January 1, 1970 UTC)  */
    getTime() {
        return this.isValid() ? this.self.getTime() : NaN;
    }
    /** Alias of {@link IntlDate.getTime}  */
    valueOf() {
        return this.getTime();
    }
    /** Returns the timezone string name  */
    zoneName() {
        return this.format('%Z');
    }
    /** Returns the timezone GMT offset  */
    offset() {
        return this.format('%z');
    }
    /** Returns the difference in minutes between this date and UTC  */
    offsetInMinutes() {
        return this.self.getTimezoneOffset();
    }
    /**
     * Check if this date is before another date. The other value will be parsed as an `IntlDate` if not already so.
     * @param {string | number | Object | Date | IntlDate} other Another date or date like object
     * @returns {boolean} Returns `true` if this date is before the given value
     */
    isBefore(other) {
        if (other instanceof IntlDate) {
            return this.getTime() < other.getTime();
        }
        return this.getTime() < new IntlDate(other).getTime();
    }
    /**
     * Check if this date is strictly after the given `start` and before `stop` dates. The values will be parsed as an `IntlDate` if not already so.
     * @param {string | number | Object | Date | IntlDate} start The smaller date
     * @param {string | number | Object | Date | IntlDate} stop The larger date
     * @returns {boolean} Returns `true` if this date is greater than `start` and less than `stop`.
     */
    isBetween(start, stop) {
        return this.isAfter(start) && this.isBefore(stop);
    }
    /**
     * Check if this date is after another date. The other value will be parsed as an `IntlDate` if not already so.
     * @param {string | number | DateParts | Date | IntlDate} other Another date or date like object
     * @returns {boolean} Returns `true` if this date is after the given value
     */
    isAfter(other) {
        if (other instanceof IntlDate) {
            return this.getTime() > other.getTime();
        }
        return this.getTime() > new IntlDate(other).getTime();
    }
    /**
     * Check if this date is the same as `other`.
     * @param other Another date object
     * @returns {boolean} Returns `true` if this date is the same as other
     */
    isSame(other) {
        if (other instanceof IntlDate) {
            return (this.isValid() &&
                other.isValid() &&
                this.getTime() === other.getTime() &&
                this.locale === other.locale);
        }
        return this.getTime() === other.getTime();
    }
    lt(other) {
        return this.isBefore(other);
    }
    eq(other) {
        return this.isSame(other);
    }
    compare(other) {
        if (!this.isValid())
            return 1;
        let dt = new IntlDate(other);
        if (!dt.isValid())
            return -1;
        return this.getTime() - dt.getTime();
    }
    set(values) {
        if (!this.isValid())
            return this;
        const normalized = normalizeObject(values, normalizeUnit);
        let mixed = { ...this.toObject(), ...normalized };
        // if we didn't set the day but we ended up on an overflow date,
        // use the last day of the right month
        if (normalized.day === undefined) {
            mixed.day = Math.min(daysInMonth(mixed.year, mixed.month), mixed.day);
        }
        return this.clone(mixed);
    }
    get relativeFormat() {
        if (this.intlRelativeFormat)
            return this.intlRelativeFormat;
        this.intlRelativeFormat = new Intl.RelativeTimeFormat(this.locale);
        return new Intl.RelativeTimeFormat(this.locale);
    }
    relativeTime(n, unit = 'seconds') {
        return this.relativeFormat.format(n, unit);
    }
    fromNow(unit = 'seconds') {
        let diff = this.diff(new Date(), unit);
        return this.relativeTime(diff, unit);
    }
    from(other, unit = 'seconds') {
        let diff = this.diff(other, unit);
        return this.relativeTime(diff, unit);
    }
    toNow(unit = 'seconds') {
        let diff = this.diff(new Date(), unit);
        return this.relativeTime(-diff, unit);
    }
    to(other, unit = 'seconds') {
        let diff = this.diff(other, unit);
        return this.relativeTime(-diff, unit);
    }
    diff(other, unit = 'milliseconds', exact = false) {
        let dt = new IntlDate(other);
        let dur = new Duration(this.getTime() - dt.getTime(), exact);
        return dur.total(unit);
    }
    // TODO: Parsing
    // Parse String + Date Format
    // Parse String + Time Format
    // Parse String + Format + locale
    add(duration, exact = false) {
        return this.clone(addDuration(this.self, duration, exact));
    }
    subtract(duration, exact = false) {
        return this.clone(subtract(this.self, duration, exact));
    }
    startOf(unit) {
        if (!this.isValid())
            return this;
        const obj = {}, normalizedUnit = UNITS_PLURAL[unit.toLowerCase()];
        switch (normalizedUnit) {
            case 'years':
                obj.month = 1;
            // falls through
            case 'quarters':
            case 'months':
                obj.day = 1;
            // falls through
            case 'weeks':
            case 'days':
                obj.hour = 0;
            // falls through
            case 'hours':
                obj.minute = 0;
            // falls through
            case 'minutes':
                obj.second = 0;
            // falls through
            case 'seconds':
                obj.millisecond = 0;
                break;
            case 'milliseconds':
                break;
            // no default, invalid units throw in normalizeUnit()
        }
        if (normalizedUnit === 'weeks') {
            obj.weekday = 1;
        }
        if (normalizedUnit === 'quarters') {
            const q = Math.ceil(this.month / 3);
            obj.month = (q - 1) * 3 + 1;
        }
        return this.set(obj);
    }
    endOf(unit) {
        return this.isValid()
            ? this.add({ [unit]: 1 })
                .startOf(unit)
                .subtract({ milliseconds: 1 })
            : this;
    }
    clone(date) {
        return new IntlDate(date ?? this, { locale: this.locale });
    }
}
// Check if the new offset is different because we crossed to DST
function fixOffset(startDate, endDate) {
    let startOffset = startDate.getTimezoneOffset();
    let endOffset = endDate.getTimezoneOffset();
    if (startOffset === endOffset)
        return new Date(endDate);
    let postoffset = (startOffset - endOffset) * 60 * 1000;
    return new Date(+endDate + postoffset);
}
export function addDuration(date, duration, exact = false) {
    // Get the current offset of this date timezone
    let newDate = new Date(date);
    // Get the number of ticks forward
    let { values } = new Duration(duration, exact).normalize();
    // Apply any time changes that may have happened
    for (const unit in values) {
        setDateUnit(newDate, unit, Math.floor(values[unit]));
    }
    return fixOffset(new Date(date), newDate);
}
function setDateUnit(date, unit, value) {
    switch (unit) {
        case 'years':
            date.setFullYear(date.getFullYear() + value);
            break;
        case 'quarters':
            date.setMonth(date.getMonth() + value * 3);
            break;
        case 'months':
            date.setMonth(date.getMonth() + value);
            break;
        case 'weeks':
            date.setDate(date.getDate() + value * 7);
            break;
        case 'days':
            date.setDate(date.getDate() + value);
            break;
        case 'hours':
            date.setHours(date.getHours() + value);
            break;
        case 'minutes':
            date.setMinutes(date.getMinutes() + value);
            break;
        case 'seconds':
            date.setSeconds(date.getSeconds() + value);
            break;
        case 'milliseconds':
            date.setMilliseconds(date.getMilliseconds() + value);
            break;
        default:
            break;
    }
    return date;
}
export function subtract(date, duration, exact = false) {
    return addDuration(date, new Duration(duration, exact).negated(), exact);
}
const UNITS_SINGULAR = {
    year: 'year',
    years: 'year',
    month: 'month',
    months: 'month',
    day: 'day',
    days: 'day',
    hour: 'hour',
    hours: 'hour',
    minute: 'minute',
    minutes: 'minute',
    quarter: 'quarter',
    quarters: 'quarter',
    second: 'second',
    seconds: 'second',
    millisecond: 'millisecond',
    milliseconds: 'millisecond',
    weekday: 'weekday',
    weekdays: 'weekday',
    weeknumber: 'weekNumber',
    weeksnumber: 'weekNumber',
    weeknumbers: 'weekNumber',
    weekyear: 'weekYear',
    weekyears: 'weekYear',
    ordinal: 'ordinal'
};
function normalizeUnit(unit) {
    const normalized = UNITS_SINGULAR[unit.toLowerCase()];
    if (!normalized)
        throw new ValueError(`Invalid unit ${unit}`);
    return normalized;
}
function normalizeObject(obj, normalizer) {
    const normalized = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value == null)
            continue;
        normalized[normalizer(key)] = asNumber(value);
    }
    return normalized;
}
