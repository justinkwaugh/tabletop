import { type TSchema, type Static } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'

export type HydratedChildren = Record<string, Hydratable<TSchema> | Hydratable<TSchema>[]>

export abstract class Hydratable<T extends TSchema> {
    constructor(data: Static<T>, validator: TypeCheck<T>, nested?: HydratedChildren) {
        if (!validator.Check(data)) {
            throw Error(JSON.stringify([...validator.Errors(data)]))
        }

        Object.assign(this, data, nested)
    }

    dehydrate() {
        return structuredClone(this)
    }
}
