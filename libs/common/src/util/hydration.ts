import { type TSchema, type Static } from 'typebox'
import { Validator } from 'typebox/compile'

export type HydratedChildren = Record<string, Hydratable<TSchema> | Hydratable<TSchema>[]>

export abstract class Hydratable<T extends TSchema> {
    constructor(data: Static<T>, validator: Validator<{}, T>, nested?: HydratedChildren) {
        if (!validator.Check(data)) {
            console.log('Hydration validation failed:', data)
            throw Error(JSON.stringify([...validator.Errors(data)]))
        }

        Object.assign(this, structuredClone(data), nested)
    }

    dehydrate() {
        return structuredClone(this)
    }
}
