import { describe, expect, test } from 'vitest'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { DrawBag, HydratedDrawBag } from './drawBag.js'

const TokenBag = DrawBag(Type.String())
type TokenBag = Type.Static<typeof TokenBag>
const TokenBagValidator = Compile(TokenBag)

class HydratedTokenBag extends HydratedDrawBag<string, typeof TokenBag> implements TokenBag {
    constructor(data: TokenBag) {
        super(data, TokenBagValidator)
    }
}

describe('HydratedDrawBag', () => {
    test('adding several items counts each of them', () => {
        const bag = new HydratedTokenBag({ items: ['a'], remaining: 1 })

        bag.addItems(['b', 'c'])

        expect(bag.count()).toBe(3)
        expect(bag.drawItems(3).sort()).toEqual(['a', 'b', 'c'])
        expect(bag.isEmpty()).toBe(true)
    })

    test('adding one item counts it once', () => {
        const bag = new HydratedTokenBag({ items: [], remaining: 0 })

        bag.addItem('a')

        expect(bag.count()).toBe(1)
        expect(bag.draw()).toBe('a')
    })
})
