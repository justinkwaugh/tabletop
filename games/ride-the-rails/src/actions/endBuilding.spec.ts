import { ActionSource, MachineContext, latestPlayerUndoTarget } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import {
    buildState,
    buildingMetadataOf,
    runAction,
    undoRun,
    type StateRecipe
} from '../testing/fixtures.js'
import { HydratedFinishBuilding, scheduleFinishBuilding } from './finishBuilding.js'

const PHILADELPHIA: HexId = 'hex.usa.7-57'
const WEST_OF_PHILADELPHIA: HexId = 'hex.usa.7-55'

function building(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    return buildState({
        round: 1,
        phase: PhaseName.Build,
        shares: { p1: { 'railroad.red': 1 }, p2: { 'railroad.blue': 1 } },
        track: { [PHILADELPHIA]: ['railroad.red'] },
        ...recipe
    })
}

function endBuilding(state: HydratedRideTheRailsGameState, playerId = 'p1') {
    return runAction(state, { type: ActionType.EndBuilding, playerId })
}

function finishBuilding(playerId = 'p1') {
    return new HydratedFinishBuilding({
        id: 'f',
        gameId: 'g',
        source: ActionSource.System,
        type: ActionType.FinishBuilding,
        playerId
    })
}

function contextFor(state: HydratedRideTheRailsGameState) {
    return new MachineContext({ gameConfig: {}, gameState: state })
}

describe('EndBuilding (R-3.2.1, R-2.2)', () => {
    it('ends a turn with no placement', () => {
        const { after, processed } = endBuilding(building())
        expect(after.activePlayerIds).toEqual(['p2'])
        expect(after.building).toEqual({ placed: 0, usedMountain: false })
        expect(processed.map((action) => action.type)).toEqual([ActionType.EndBuilding])
        expect(buildingMetadataOf(processed[0])).toEqual({ placed: 0 })
    })

    it('ends a turn after some placements, with the limit not reached', () => {
        const { after, processed } = endBuilding(
            building({ building: { placed: 3, usedMountain: true } })
        )
        expect(after.activePlayerIds).toEqual(['p2'])
        expect(after.building).toEqual({ placed: 0, usedMountain: false })
        expect(buildingMetadataOf(processed[0])).toEqual({ placed: 3 })
    })

    it('is refused outside the player’s building turn', () => {
        expect(() => endBuilding(building(), 'p2')).toThrow()
        const takingShares = buildState({ currentPlayerId: 'p1' })
        expect(() => endBuilding(takingShares)).toThrow()
    })

    it('is undone on its own (R-5)', () => {
        const run = endBuilding(building({ building: { placed: 2, usedMountain: false } }))
        expect(latestPlayerUndoTarget(run.processed, 'p1')?.type).toBe(ActionType.EndBuilding)
        expect(undoRun(run)).toEqual(run.before)
    })
})

describe('FinishBuilding (R-3.2.1, R-3.2.3, R-3.2.4)', () => {
    it('is scheduled as a turn opens with nothing to build', () => {
        const state = building({ shares: { p1: {} } })
        const context = contextFor(state)
        expect(scheduleFinishBuilding(context, 'p1')).toBe(true)
        expect(context.getPendingActions()).toMatchObject([
            { type: ActionType.FinishBuilding, source: ActionSource.System, playerId: 'p1' }
        ])
    })

    it('is not scheduled while a placement is legal, or outside the player’s building turn', () => {
        const context = contextFor(building())
        expect(scheduleFinishBuilding(context, 'p1')).toBe(false)
        expect(scheduleFinishBuilding(context, 'p2')).toBe(false)
        expect(context.getPendingActions()).toEqual([])
    })

    it('closes the turn and records why and how many were placed', () => {
        const nothingLegal = building({ shares: { p1: {} } })
        const action = finishBuilding()
        action.apply(nothingLegal)
        expect(nothingLegal.building).toBeUndefined()
        expect(action.metadata).toEqual({ reason: 'nothing-legal', placed: 0 })

        const atLimit = building({ building: { placed: 8, usedMountain: false } })
        const limited = finishBuilding()
        limited.apply(atLimit)
        expect(limited.metadata).toEqual({ reason: 'limit', placed: 8 })
    })

    it('refuses to end a turn that still has a legal placement', () => {
        expect(() => finishBuilding().apply(building())).toThrow(/still legal/)
    })

    it('runs in the cascade of the placement that made it due', () => {
        const state = building({ building: { placed: 7, usedMountain: false } })
        const { processed } = runAction(state, {
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: 'railroad.red',
            hexId: WEST_OF_PHILADELPHIA
        })
        expect(processed.map((action) => [action.type, buildingMetadataOf(action)])).toEqual([
            [ActionType.PlaceLocomotive, { isStart: false, bonuses: [] }],
            [ActionType.FinishBuilding, { reason: 'limit', placed: 8 }]
        ])
    })
})
