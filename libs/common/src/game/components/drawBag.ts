import * as Type from 'typebox'
import { shuffle } from '../../util/shuffle.js'
import { Hydratable } from '../../util/hydration.js'
import { type RandomFunction } from '../../util/prng.js'

export const DrawBag = <T extends Type.TSchema>(T: T) =>
    Type.Object({
        items: Type.Array(T),
        remaining: Type.Number()
    })

export type AnyDrawBag = Type.Static<typeof AnyDrawBag>
export const AnyDrawBag = Type.Object({
    items: Type.Array(Type.Any()),
    remaining: Type.Number()
})

export abstract class HydratedDrawBag<T, U extends Type.TSchema> extends Hydratable<U> {
    //
    declare items: T[]
    declare remaining: number

    count(): number {
        return this.remaining
    }

    addItem(item: T) {
        this.addItems([item])
    }

    addItems(items: T[]) {
        this.fixOldBags()

        this.items.push(...structuredClone(items))
        this.remaining += 1
    }

    shuffle(random?: RandomFunction) {
        this.fixOldBags()

        shuffle(this.items, random)
    }

    isEmpty(): boolean {
        return this.count() == 0
    }

    draw(random?: RandomFunction): T {
        return this.drawItems(1, random)[0]
    }

    drawItems(count: number = 1, random?: RandomFunction): T[] {
        this.fixOldBags()

        if (count < 1 || count > this.count()) {
            throw Error('Trying to draw an invalid amount of items')
        }
        if (random) {
            this.shuffle(random)
        }

        this.remaining -= count

        // Remove count items
        return structuredClone(this.items.splice(this.remaining, count))
    }

    // For reasons I don't remember, the original implementation never adjusted the items array
    // which I think was a mistake.  This will pare any old items down to the remaining count.
    private fixOldBags() {
        if (this.items.length > this.remaining) {
            this.items.splice(this.remaining)
        }
    }
}
