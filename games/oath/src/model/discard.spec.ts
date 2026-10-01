import { describe, expect, it } from 'vitest'
import { discardRegionFor } from './gameState.js'
import { CardKind, Region } from './oathEnums.js'
import { isVision, kindOf } from '../data/cardRegistry.js'
import {
    DISCARD_SEARCH_SUPPLY_COST,
    visionsDrawnAfter,
    worldDeckSearchCost
} from '../data/visionsDrawnTrack.js'
import { testState, testPlayer } from '../testing/fixture.js'

describe('discard targets (R-10.5)', () => {
    it('sends a Cradle pawn discard to the Provinces pile', () => {
        expect(discardRegionFor(Region.Cradle)).toBe(Region.Provinces)
    })

    it('sends a Provinces pawn discard to the Hinterland pile', () => {
        expect(discardRegionFor(Region.Provinces)).toBe(Region.Hinterland)
    })

    it('wraps a Hinterland pawn discard round to the Cradle pile', () => {
        expect(discardRegionFor(Region.Hinterland)).toBe(Region.Cradle)
    })

    it('never sends a discard to the discarding pawn own region', () => {
        for (const region of Object.values(Region)) {
            expect(discardRegionFor(region)).not.toBe(region)
        }
    })

    it('resolves the target pile count for a region through the state', () => {
        const state = testState([testPlayer()], {
            discardPileCounts: {
                [Region.Cradle]: 1,
                [Region.Provinces]: 2,
                [Region.Hinterland]: 3
            }
        })
        expect(state.discardPileCountFor(Region.Cradle)).toBe(2)
        expect(state.discardPileCountFor(Region.Provinces)).toBe(3)
        expect(state.discardPileCountFor(Region.Hinterland)).toBe(1)
    })
})

describe('Visions Drawn track (R-2.1.6, R-5.1.1)', () => {
    it('costs 2 Supply with no Visions drawn', () => {
        expect(worldDeckSearchCost(0)).toBe(2)
    })

    it('costs 3 Supply with one or two Visions drawn', () => {
        expect(worldDeckSearchCost(1)).toBe(3)
        expect(worldDeckSearchCost(2)).toBe(3)
    })

    it('costs 4 Supply with three to five Visions drawn', () => {
        expect(worldDeckSearchCost(3)).toBe(4)
        expect(worldDeckSearchCost(4)).toBe(4)
        expect(worldDeckSearchCost(5)).toBe(4)
    })

    it('stops the marker on the last space (R-8.5), so the cost is never read off the end', () => {
        expect(visionsDrawnAfter(4, 1)).toBe(5)
        expect(visionsDrawnAfter(5, 1)).toBe(5)
        expect(() => worldDeckSearchCost(6)).toThrow('the Visions Drawn track has no space 6')
    })

    it('charges a flat 2 Supply for a discard pile, whatever the track shows', () => {
        expect(DISCARD_SEARCH_SUPPLY_COST).toBe(2)
    })
})

describe('card kinds', () => {
    it('reads a kind off the id prefix', () => {
        expect(kindOf('denizen.hearth.tinkers-fair')).toBe(CardKind.Denizen)
        expect(kindOf('vision.conquest')).toBe(CardKind.Vision)
        expect(kindOf('site.the-tribunal')).toBe(CardKind.Site)
        expect(kindOf('relic.grand-scepter')).toBe(CardKind.Relic)
    })

    it('returns undefined for an id with no recognised kind', () => {
        expect(kindOf('nonsense.foo')).toBeUndefined()
    })

    it('identifies every Vision, the Conspiracy included (R-8.5)', () => {
        for (const id of [
            'vision.conquest',
            'vision.rebellion',
            'vision.sanctuary',
            'vision.faith',
            'vision.conspiracy'
        ]) {
            expect(isVision(id)).toBe(true)
        }
        expect(isVision('denizen.hearth.tinkers-fair')).toBe(false)
    })
})
