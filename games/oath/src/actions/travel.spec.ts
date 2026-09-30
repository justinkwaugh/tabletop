import { describe, expect, it } from 'vitest'
import { Region } from '../model/oathEnums.js'
import { baseTravelCost } from '../util/travelCost.js'
import { HydratedTravel, Travel } from './travel.js'

import { testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'

function player(id: string, siteId: string | undefined, supply: number) {
    return testPlayer({ playerId: id, siteId, supply })
}

function stateWith(players: ReturnType<typeof testPlayer>[]) {
    return testState(players)
}

function travel(playerId: string, siteId: string) {
    return new HydratedTravel(buildAction(Travel, { playerId, siteId }))
}

describe('travel cost table (R-5.6.1, R-10.27)', () => {
    it('from the Cradle: 1 to the other Cradle site, 2 to Provinces, 4 to Hinterland', () => {
        expect(baseTravelCost(Region.Cradle, Region.Cradle)).toBe(1)
        expect(baseTravelCost(Region.Cradle, Region.Provinces)).toBe(2)
        expect(baseTravelCost(Region.Cradle, Region.Hinterland)).toBe(4)
    })

    it('from the Provinces: 2 to any other site', () => {
        expect(baseTravelCost(Region.Provinces, Region.Cradle)).toBe(2)
        expect(baseTravelCost(Region.Provinces, Region.Provinces)).toBe(2)
        expect(baseTravelCost(Region.Provinces, Region.Hinterland)).toBe(2)
    })

    it('from the Hinterland: 3 within, 2 to Provinces, 4 to Cradle', () => {
        expect(baseTravelCost(Region.Hinterland, Region.Hinterland)).toBe(3)
        expect(baseTravelCost(Region.Hinterland, Region.Provinces)).toBe(2)
        expect(baseTravelCost(Region.Hinterland, Region.Cradle)).toBe(4)
    })

    it('is not symmetric within a region', () => {
        expect(baseTravelCost(Region.Cradle, Region.Cradle)).toBe(1)
        expect(baseTravelCost(Region.Provinces, Region.Provinces)).toBe(2)
        expect(baseTravelCost(Region.Hinterland, Region.Hinterland)).toBe(3)
    })
})

describe('Travel action (R-5.6)', () => {
    it('R-10.30 — moves the pawn and spends the region-appropriate Supply', () => {
        const state = stateWith([player('p1', 'c1', 7)])
        travel('p1', 'p2').apply(state)

        const p = state.getPlayerState('p1')
        expect(p.siteId).toBe('p2')
        expect(p.supply).toBe(5)
    })

    it('tracks Supply spent this turn separately from the marker (R-4.3.4)', () => {
        const state = stateWith([player('p1', 'h1', 7)])
        travel('p1', 'h2').apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(4)
        // R-4.3.4 — the Rest refund is computed from this ledger, not the Supply marker.
        expect(p.supplySpentThisTurn).toBe(3)
    })

    it('records where the pawn came from in metadata', () => {
        const state = stateWith([player('p1', 'c1', 7)])
        const action = travel('p1', 'h3')
        action.apply(state)

        expect(action.metadata).toEqual({
            fromSiteId: 'c1',
            supplySpent: 4,
            supplyRemaining: 3,
            // R-5.6.2 — the fixture's sites are all faceup, so nothing is revealed.
            revealedSiteCardId: undefined,
            relicsRevealed: 0
        })
    })

    it('refuses a destination the player cannot afford', () => {
        const state = stateWith([player('p1', 'c1', 3)])
        expect(() => travel('p1', 'h1').apply(state)).toThrow(/costs 4 Supply/)
    })

    it('refuses travel to the site the pawn already occupies', () => {
        const state = stateWith([player('p1', 'p2', 7)])
        expect(() => travel('p1', 'p2').apply(state)).toThrow(/already occupies/)
    })

    it('refuses a destination that is not on the map', () => {
        const state = stateWith([player('p1', 'c1', 7)])
        expect(() => travel('p1', 'nowhere').apply(state)).toThrow(/not a site on the map/)
    })

    it('lists only affordable destinations', () => {
        const state = stateWith([player('p1', 'c1', 2)])
        expect(HydratedTravel.legalDestinations(state, 'p1').sort()).toEqual([
            'c2',
            'p1',
            'p2',
            'p3'
        ])
    })

    it('reports no legal destinations when Supply is exhausted', () => {
        const state = stateWith([player('p1', 'c1', 0)])
        expect(HydratedTravel.legalDestinations(state, 'p1')).toEqual([])
        expect(HydratedTravel.canDoTravel(state, 'p1')).toBe(false)
    })

    it('treats a pawn off the map as a broken invariant, since Travel follows setup (R-1.23.1)', () => {
        const state = stateWith([player('p1', undefined, 7)])
        expect(() => HydratedTravel.costFor(state, 'p1', 'c1')).toThrow("p1's pawn must be at a site")
        expect(() => HydratedTravel.canDoTravel(state, 'p1')).toThrow("p1's pawn must be at a site")
    })
})
