import type * as Type from 'typebox'
import { Validator } from 'typebox/compile'

export abstract class Hydratable<T extends Type.TSchema> {
    private _validator: Validator<{}, T>

    constructor(data: Type.Static<T>, validator: Validator<{}, T>) {
        this._validator = validator

        if (!validator.Check(data)) {
            throw Error(JSON.stringify(validator.Errors(data)))
        }

        // Insure incoming data is dehydrated otherwise clone fails
        if ((data as any) instanceof Hydratable) {
            data = data.dehydrate()
        } else {
            // shallow dehydrate any nested Hydratable properties
            data = { ...data }
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                    data[key] = value.map((item) =>
                        item instanceof Hydratable ? item.dehydrate() : item
                    )
                } else if (value instanceof Hydratable) {
                    data[key] = value.dehydrate()
                }
            }
        }

        Object.assign(this, structuredClone(data))
    }

    private cloneable(): Type.Static<T> {
        // Shallow clone removes the _validator property
        const { _validator, ...rest } = this

        this.dehydrateChildren(rest)

        // Return the shallow clone
        return rest as Type.Static<T>
    }

    private dehydrateChildren(obj: object) {
        for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
                ;(obj as any)[key] = value.map((item) =>
                    item instanceof Hydratable ? item.dehydrate() : item
                )
            } else if (value instanceof Hydratable) {
                ;(obj as any)[key] = value.dehydrate()
            } else if (value && typeof value === 'object') {
                this.dehydrateChildren(value)
            }
        }
    }

    dehydrate(): Type.Static<T> {
        return this._validator.Clean(structuredClone(this.cloneable())) as Type.Static<T>
    }
}
