import * as Type from 'typebox'

// ------------------------------------------------------------------
// Definition
// ------------------------------------------------------------------
export class TDate extends Type.Base<globalThis.Date> {
    constructor(public readonly format = 'date-time') {
        super()
    }
    public override Check(value: unknown): value is globalThis.Date {
        return value instanceof globalThis.Date
    }

    public override Errors(value: unknown): object[] {
        return this.Check(value) ? [] : [{ message: 'must be Date' }]
    }

    public override Create(): globalThis.Date {
        return new globalThis.Date(0)
    }

    public override Clone(): TDate {
        return new TDate(this.format)
    }

    public override Convert(value: unknown): unknown {
        if (typeof value === 'string' || typeof value === 'number') {
            const date = new Date(value)
            if (!isNaN(date.getTime())) {
                return date
            }
        }
        return value
    }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function DateType(): TDate {
    return new TDate()
}
