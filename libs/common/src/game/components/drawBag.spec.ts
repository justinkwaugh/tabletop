import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import * as Compiler from 'typebox/compile'
import { DrawBag, HydratedDrawBag } from './drawBag.js'
import { range } from '../../util/range.js'
import { Prng } from './prng.js'

export type Thing = Type.Static<typeof Thing>
export const Thing = Type.Object({
    id: Type.String()
})

export type TestBag = Type.Static<typeof TestBag>
export const TestBag = DrawBag(Thing)

export const TestBagValidator = Compiler.Compile(TestBag)

export class HydratedTestBag extends HydratedDrawBag<Thing, typeof TestBag> implements TestBag {
    constructor(data: TestBag) {
        super(data, TestBagValidator)
    }
}

describe('DrawBag Tests', () => {
    it('draws in order with no prng provided', () => {
        const items = range(0, 10).map((i) => ({ id: `item${i}` }))
        const bagData: TestBag = {
            items: items,
            remaining: items.length
        }
        const bag = new HydratedTestBag(bagData)
        const drawItem = bag.draw()
        expect(drawItem.id).toBe('item9')
        expect(bag.count()).toBe(9)

        const drawItems = bag.drawItems(3)
        expect(drawItems.map((i) => i.id)).toEqual(['item8', 'item7', 'item6'])
        expect(bag.count()).toBe(6)

        const allRemaining = bag.drawItems(bag.count())
        expect(allRemaining.map((i) => i.id)).toEqual([
            'item5',
            'item4',
            'item3',
            'item2',
            'item1',
            'item0'
        ])
        expect(bag.count()).toBe(0)
    })

    it('draws randomly with prng provided', () => {
        const items = range(0, 10).map((i) => ({ id: `item${i}` }))
        const bagData: TestBag = {
            items: items,
            remaining: items.length
        }
        const bag = new HydratedTestBag(bagData)

        const prngSeed = Math.floor(Math.random() * 1000000)
        const testPrng = new Prng({ seed: prngSeed, invocations: 0 })
        const bagPrng = new Prng({ seed: prngSeed, invocations: 0 })

        const randomIndex = testPrng.randInt(bag.count())
        const drawItem = bag.draw(bagPrng)
        expect(drawItem.id).toBe(`item${randomIndex}`)
        expect(bag.count()).toBe(9)
        expect(bag.items[randomIndex].id).toBe('item9')

        const randomIndices = [testPrng.randInt(bag.count()), testPrng.randInt(bag.count() - 1)]
        const drawnIds =
            randomIndices[0] === randomIndices[1]
                ? [bag.items[randomIndices[1]].id, bag.items[bag.count() - 1].id]
                : [bag.items[randomIndices[0]].id, bag.items[randomIndices[1]].id]

        const drawItems = bag.drawItems(2, bagPrng)
        expect(drawItems.map((i) => i.id)).toEqual(drawnIds)
        expect(bag.count()).toBe(7)

        const remainingItems = bag.drawItems(bag.count(), bagPrng)
        expect(remainingItems.length).toBe(7)
        expect(bag.count()).toBe(0)
    })
})
