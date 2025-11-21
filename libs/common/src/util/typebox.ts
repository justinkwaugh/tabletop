import Type from 'typebox'

// ------------------------------------------------------------------
// Definition
// ------------------------------------------------------------------
export class TDate extends Type.Base<globalThis.Date> {
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
        return structuredClone(this)
    }

    public override Convert(value: unknown): unknown {
        if (typeof value === 'string' || typeof value === 'number') {
            const date = new globalThis.Date(value)
            if (this.Check(date)) return date
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
