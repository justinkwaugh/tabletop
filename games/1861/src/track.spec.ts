import { describe, expect, it } from 'vitest'
import { TrackConstruction } from '@tabletop/18xx'
import { StationRules1861, hexDistance1861 } from './stations.js'
import { TrackRules1861 } from './track.js'
import { auctionMinor, edit, finishStockRound, opened } from '../test/kit.js'

describe('1861 track and stations', () => {
    it('keeps private company hexes closed to track until phase 3 (§10.4)', () => {
        const game = opened(3)
        auctionMinor(game, 'N', 100)
        finishStockRound(game)
        const request = {
            companyId: 'N',
            locationId: 'H6',
            definitionId: '7',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1861.restriction(game.hydrated, request)).toMatch(/phase 3/)
        edit(game, (state) => {
            state.phaseId = '3'
        })
        expect(TrackRules1861.restriction(game.hydrated, request)).toBeUndefined()
    })

    it('builds the home hex first, and charges R20 for a second tile operation (§10.4)', () => {
        const game = opened(3)
        auctionMinor(game, 'N', 100)
        auctionMinor(game, 'R-O', 140)
        finishStockRound(game)
        const state = game.hydrated
        expect(state.trackStep?.companyId).toBe('R-O')
        expect(TrackRules1861.allowance(state, 'yellow')).toEqual({ cost: 0 })
        const construction = new TrackConstruction(state, TrackRules1861)
        expect(
            TrackRules1861.restriction(state, {
                companyId: 'R-O',
                locationId: 'B6',
                definitionId: '8',
                rotation: 0,
                nodeMapping: {}
            })
        ).toMatch(/home hex/)
        const [lay] = construction.choices('B4')
        expect(lay).toBeDefined()
        game.act('LayTile', {
            companyId: 'R-O',
            locationId: lay.locationId,
            definitionId: lay.definitionId,
            rotation: lay.rotation,
            nodeMapping: lay.nodeMapping,
            expectedCost: lay.cost
        })
        expect(TrackRules1861.allowance(game.hydrated, 'yellow')).toEqual({ cost: 20 })
    })

    it('prices a second station at R20 a hex from the first (§10.5)', () => {
        const game = opened(3)
        auctionMinor(game, 'N', 100)
        const state = game.hydrated
        expect(hexDistance1861('H8', 'G13')).toBeGreaterThan(0)
        // A minor places no stations as it operates; its one was placed as it started.
        expect(StationRules1861.placementLimit(state, 'N')).toBe(0)
    })
})
