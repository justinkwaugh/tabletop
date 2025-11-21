import { type TSchema, type Static } from 'typebox'
import { Validator } from 'typebox/compile'

export abstract class Hydratable<T extends TSchema> {
    private _validator: Validator<{}, T>

    constructor(data: Static<T>, validator: Validator<{}, T>) {
        this._validator = validator

        if (!validator.Check(data)) {
            console.log('Hydration validation failed:', data)
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

        this.hydrateProperties()
    }

    // Override this to hydrate nested properties
    protected hydrateProperties() {}

    private cloneable(): Static<T> {
        // Shallow clone removes the _validator property
        const { _validator, ...rest } = this

        // Dehydrate any nested Hydratable properties
        for (const [key, value] of Object.entries(rest)) {
            if (Array.isArray(value)) {
                ;(rest as any)[key] = value.map((item) =>
                    item instanceof Hydratable ? item.dehydrate() : item
                )
            } else if (value instanceof Hydratable) {
                ;(rest as any)[key] = value.dehydrate()
            }
        }

        // Return the shallow clone
        return rest as Static<T>
    }

    dehydrate(): Static<T> {
        return this._validator.Clean(structuredClone(this.cloneable())) as Static<T>
    }
}
