import { Type, type TSchema, type Static } from '@sinclair/typebox'
import { shuffle } from '../../util/shuffle.js'
import { Hydratable } from '../../util/hydration.js'
import { RandomFunction } from '../../util/prng.js'

export const DrawBag = <T extends TSchema>(T: T) =>
    Type.Object({
        items: Type.Array(T),
        remaining: Type.Number()
    })

export type AnyDrawBag = Static<typeof AnyDrawBag>
export const AnyDrawBag = Type.Object({
    items: Type.Array(Type.Any()),
    remaining: Type.Number()
})

export abstract class HydratedDrawBag<T, U extends TSchema> extends Hydratable<U> {
    //
    declare items: T[]
    declare remaining: number

    count(): number {
        return this.remaining
    }

    shuffle(random?: RandomFunction) {
        shuffle(this.items, random)
    }

    isEmpty(): boolean {
        return this.remaining == 0
    }

    draw(): T {
        if (this.isEmpty()) {
            throw Error('Trying to draw from empty bag')
        }
        this.remaining -= 1
        return structuredClone(this.items[this.remaining])
    }
}
