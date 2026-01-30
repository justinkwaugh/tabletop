import * as Type from 'typebox'
import { shuffle } from '../../util/shuffle.js'
import { Hydratable } from '../../util/hydration.js'
import { type RandomFunction } from '../../util/prng.js'
import { Prng } from './prng.js'
import { assertExists } from '../../util/assertions.js'
import { range } from 'src/util/range.js'

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

    draw(prng?: Prng): T {
        return this.drawItems(1, prng)[0]
    }

    // Without a PRNG, draws from the "top" of the bag.  With a PRNG, draws random items.
    drawItems(count: number = 1, prng?: Prng): T[] {
        this.fixOldBags()

        if (count < 1 || count > this.count()) {
            throw Error('Trying to draw an invalid amount of items')
        }

        if (prng) {
            return Array.from({ length: count }, () => this.drawRandomItem(prng))
        } else {
            this.remaining -= count
            return structuredClone(this.items.splice(this.remaining, count)).reverse()
        }
    }

    // There are multiple ways to skin this cat. The simplest is to just shuffle and pop,
    // however that does create an undo patch that contains a change for every card. Instead
    // we just randomly choose an item and pop the last item, putting it in the chosen item's spot
    // which results in only n + 1 changes for drawing n items.
    private drawRandomItem(prng: Prng): T {
        // Pick a random item
        const index = prng.randInt(this.remaining) // 0 to remaining - 1
        const item = structuredClone(this.items[index])

        // Pop and move the last item into the removed spot
        const lastItem = this.items.pop()
        assertExists(lastItem, 'Last item should exist when drawing from draw bag')
        this.remaining -= 1

        // Only put the last item in the drawn spot if we didn't just pop it
        if (index !== this.remaining) {
            this.items[index] = lastItem
        }
        return item
    }

    // For reasons I don't remember, the original implementation never adjusted the items array
    // which I think was a mistake.  This will pare any old items down to the remaining count.
    private fixOldBags() {
        if (this.items.length > this.remaining) {
            this.items.splice(this.remaining)
        }
    }
}
