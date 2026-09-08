import * as Type from 'typebox'
import { shuffle } from '../../util/shuffle.js'
import { Hydratable } from '../../util/hydration.js'
import { type RandomFunction } from '../../util/prng.js'
import * as Visibility from '../visibility/index.js'

export const DrawBag = <Item extends Type.TSchema>(item: Item) =>
    Type.Object({
        items: Visibility.protect(Type.Array(item), {
            policy: Visibility.Policy.HostOnly,
            redaction: Visibility.redaction.emptyArray()
        }),
        remaining: Type.Number()
    })

export type AnyDrawBag = Type.Static<typeof AnyDrawBag>
export const AnyDrawBag = DrawBag(Type.Any())

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

    draw(): T {
        return this.drawItems()[0]
    }

    drawItems(count: number = 1): T[] {
        this.fixOldBags()

        if (count < 1 || count > this.count()) {
            throw Error('Trying to draw an invalid amount of items')
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
