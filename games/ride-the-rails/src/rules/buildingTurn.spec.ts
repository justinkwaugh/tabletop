import { ActionSource } from '@tabletop/common'
import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { HydratedFinishBuilding } from '../actions/finishBuilding.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import type { BuildingTurn } from '../model/gameState.js'
import { buildState } from '../testing/fixtures.js'
import { FLAT_FIXTURE_MAP, LONG_DISTANCE_HEX, MOUNTAIN_HEX } from '../testing/flatFixtureMap.js'
import { buildingTurnEnd, FinishBuildingReason, recordPlacement } from './buildingTurn.js'

const OPENED: BuildingTurn = { placed: 0, usedMountain: false }

describe('the building turn record (R-3.2.3, R-3.2.4, R-8)', () => {
    it('counts a placement, and marks the mountain only when the placement charges it', () => {
        const plain = recordPlacement(OPENED, {
            chargesMountain: false,
            longDistance: FLAT_FIXTURE_MAP.isLongDistance('hex.usa.0-0')
        })
        expect(plain).toEqual({ placed: 1, usedMountain: false })
        const mountain = recordPlacement(plain, {
            chargesMountain: true,
            longDistance: FLAT_FIXTURE_MAP.isLongDistance(MOUNTAIN_HEX)
        })
        expect(mountain).toEqual({ placed: 2, usedMountain: true })
        const exempt = recordPlacement(OPENED, {
            chargesMountain: false,
            longDistance: FLAT_FIXTURE_MAP.isLongDistance(MOUNTAIN_HEX)
        })
        expect(exempt).toEqual({ placed: 1, usedMountain: false })
    })

    it('marks a long-distance placement, and writes the mark on no other turn', () => {
        expect(
            recordPlacement(OPENED, {
                chargesMountain: false,
                longDistance: FLAT_FIXTURE_MAP.isLongDistance(LONG_DISTANCE_HEX)
            })
        ).toEqual({ placed: 1, usedMountain: false, usedLongDistance: true })
        expect(
            'usedLongDistance' in
                recordPlacement(OPENED, {
                    chargesMountain: false,
                    longDistance: FLAT_FIXTURE_MAP.isLongDistance('hex.usa.0-0')
                })
        ).toBe(false)
    })
})

describe('a turn a long-distance placement ends (R-8, Australia)', () => {
    const ended = () =>
        buildState({
            phase: PhaseName.Build,
            shares: { p1: { 'railroad.red': 1 } },
            track: { 'hex.usa.6-60': ['railroad.red'] },
            building: { placed: 1, usedMountain: false, usedLongDistance: true }
        })

    it('ends with the reason long-distance, though placements are left', () => {
        expect(buildingTurnEnd(ended(), 'p1')).toBe('long-distance')
    })

    it('finishes with long-distance in the metadata', () => {
        const state = ended()
        const finish = new HydratedFinishBuilding({
            id: 'finish',
            gameId: state.gameId,
            source: ActionSource.System,
            type: ActionType.FinishBuilding,
            playerId: 'p1'
        })
        finish.apply(state)
        expect(finish.metadata).toEqual({ reason: 'long-distance', placed: 1 })
        expect(Value.Check(FinishBuildingReason, 'long-distance')).toBe(true)
    })
})
