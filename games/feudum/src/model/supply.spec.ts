import { describe, expect, it } from 'vitest'
import { ComponentTotals } from '../data/components.js'
import { canonicalOf, initialState } from '../testing/state.js'
import { conservationBreaks } from './conservation.js'
import {
    payShillingsFromSupply,
    payShillingsToSupply,
    returnGoodToHaversack,
    takeGoodFromHaversack,
    takeShillingsFromSupply
} from './supply.js'

describe('R-1.1-H1 a limited supply of shillings', () => {
    it('starts with every shilling in the box accounted for', () => {
        expect(ComponentTotals.shillings).toBe(78)
    })

    it.each([
        { inSupply: 10, asked: 3, paid: 3, left: 7 },
        { inSupply: 3, asked: 3, paid: 3, left: 0 },
        { inSupply: 2, asked: 3, paid: 2, left: 0 },
        { inSupply: 0, asked: 3, paid: 0, left: 0 },
        { inSupply: 5, asked: 0, paid: 0, left: 5 }
    ])('a supply of $inSupply asked for $asked pays $paid', ({ inSupply, asked, paid, left }) => {
        const state = initialState()
        state.supply.shillings = inSupply
        const player = state.getPlayerState('p1')
        player.shillings = 1

        expect(payShillingsFromSupply(state, 'p1', asked)).toBe(paid)
        expect(player.shillings).toBe(1 + paid)
        expect(state.supply.shillings).toBe(left)
    })

    it('takes shillings for anything else on the same terms', () => {
        const state = initialState()
        state.supply.shillings = 2
        expect(takeShillingsFromSupply(state, 3)).toBe(2)
        expect(state.supply.shillings).toBe(0)
    })

    it('R-4.2.3 a player pays the general supply from what they hold', () => {
        const state = initialState()
        state.supply.shillings = 0
        const player = state.getPlayerState('p1')
        player.shillings = 2

        payShillingsToSupply(state, 'p1', 2)

        expect(player.shillings).toBe(0)
        expect(state.supply.shillings).toBe(2)
        expect(() => payShillingsToSupply(state, 'p1', 1)).toThrow('R-1.1')
    })
})

describe('R-1.4.4 the haversack is the supply of goods', () => {
    it.each([
        { held: 5, asked: 2, taken: 2, left: 3 },
        { held: 1, asked: 2, taken: 1, left: 0 },
        { held: 0, asked: 2, taken: 0, left: 0 }
    ])('R-1.1-H1 holding $held, asked for $asked, gives $taken', ({ held, asked, taken, left }) => {
        const state = initialState()
        state.supply.haversack.iron = held
        expect(takeGoodFromHaversack(state, 'iron', asked)).toBe(taken)
        expect(state.supply.haversack.iron).toBe(left)
    })

    it('R-5.4-H1 keeps its counts public and conserved', () => {
        const state = initialState()
        const before = conservationBreaks(canonicalOf(state)).filter(
            (broken) => broken.component === 'goods'
        )
        const taken = takeGoodFromHaversack(state, 'food', 3)
        const player = state.getPlayerState('p1')
        player.goods.food += taken
        expect(
            conservationBreaks(canonicalOf(state)).filter((broken) => broken.component === 'goods')
        ).toEqual(before)

        player.goods.food -= taken
        returnGoodToHaversack(state, 'food', taken)
        expect(
            conservationBreaks(canonicalOf(state)).filter((broken) => broken.component === 'goods')
        ).toEqual(before)
    })
})
