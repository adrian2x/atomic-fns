export declare const lowOrderMatrix: {
    weeks: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    days: {
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    hours: {
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    minutes: {
        seconds: number;
        milliseconds: number;
    };
    seconds: {
        milliseconds: number;
    };
}, casualMatrix: {
    weeks: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    days: {
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    hours: {
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    minutes: {
        seconds: number;
        milliseconds: number;
    };
    seconds: {
        milliseconds: number;
    };
    years: {
        quarters: number;
        months: number;
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    quarters: {
        months: number;
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    months: {
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
}, exactDaysInYear: number, exactDaysInMonth: number, exactMatrix: {
    weeks: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    days: {
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    hours: {
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    minutes: {
        seconds: number;
        milliseconds: number;
    };
    seconds: {
        milliseconds: number;
    };
    years: {
        quarters: number;
        months: number;
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    quarters: {
        months: number;
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
    months: {
        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    };
}, UNITS_PLURAL: {
    year: string;
    years: string;
    quarter: string;
    quarters: string;
    month: string;
    months: string;
    week: string;
    weeks: string;
    day: string;
    days: string;
    hour: string;
    hours: string;
    minute: string;
    minutes: string;
    second: string;
    seconds: string;
    millisecond: string;
    milliseconds: string;
}, orderedUnits: string[], reverseUnits: string[];
export declare type DurationUnit = keyof typeof UNITS_PLURAL;
export declare type TDuration = {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
};
export declare class Duration {
    values: TDuration;
    private matrix;
    constructor(dur?: number | TDuration | Duration, exact?: boolean);
    /** Get the years. */
    get years(): number;
    /** Get the months. */
    get months(): number;
    /** Get the weeks. */
    get weeks(): number;
    /** Get the days. */
    get days(): number;
    /** Get the hours. */
    get hours(): number;
    /** et the minutes. */
    get minutes(): number;
    /** Get the seconds. */
    get seconds(): number;
    /** Get the milliseconds. */
    get milliseconds(): number;
    /**
     * Get the value of unit.
     * @param {string} unit - a unit such as 'minute' or 'day'
     * @example Duration.fromObject({years: 2, days: 3}).get('years') // 2
     * @example Duration.fromObject({years: 2, days: 3}).get('months') // 0
     * @example Duration.fromObject({years: 2, days: 3}).get('days') // 3
     * @return {number}
     */
    get(unit: any): any;
    add(duration: TDuration): Duration;
    /**
     * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
     * @param {Duration|Object|number} duration - The amount to subtract.
     * @return {Duration}
     */
    subtract(duration: any): Duration;
    /**
     * Return the negative of this Duration.
     * @example
  ```js
  new Duration({ hours: 1, seconds: 30 }).negated().toObject()
  // { hours: -1, seconds: -30 }
  ```
     * @returns {Duration}
     */
    negated(): Duration;
    /**
     * Return the absolute values of this Duration.
     * @example
  ```js
  new Duration({ hours: 1, seconds: -30 }).abs().toObject()
  // { hours: 1, seconds: 30 }
  ```
     * @returns {Duration}
     */
    abs(): Duration;
    private shiftToAll;
    private shiftTo;
    total(unit: DurationUnit): number;
    exact(unit?: DurationUnit): number | this;
    toObject(): {
        years?: number;
        months?: number;
        weeks?: number;
        days?: number;
        hours?: number;
        minutes?: number;
        seconds?: number;
        milliseconds?: number;
    };
    normalize(): Duration;
    rescale(): Duration;
    /**
     * Returns an ISO 8601-compliant string representation of this Duration.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
     * @example Duration.fromObject({ years: 3, seconds: 45 }).toString() // 'P3YT45S'
     * @example Duration.fromObject({ months: 4, seconds: 45 }).toString() // 'P4MT45S'
     * @example Duration.fromObject({ months: 5 }).toString() // 'P5M'
     * @example Duration.fromObject({ minutes: 5 }).toString() // 'PT5M'
     * @example Duration.fromObject({ milliseconds: 6 }).toString() // 'PT0.006S'
     * @return {string}
     */
    toISOString(): string;
    toString(): string;
    /**
     * Create a Duration from an ISO 8601 duration string.
     *
     * @example
  ```js
  Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject()
  // { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
  Duration.fromISO('PT23H').toObject()
  // { hours: 23 }
  Duration.fromISO('P5Y3M').toObject()
  // { years: 5, months: 3 }
  ```
     * @return {Duration}
     */
    static fromISO(text: string): Duration;
}
