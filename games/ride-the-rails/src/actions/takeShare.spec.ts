import { ActionSource, latestPlayerUndoTarget } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { RideTheRailsHydrator } from '../definition/hydrator.js'
import { RideTheRailsApiActions } from '../definition/apiActions.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { buildState, createGame, engine } from '../testing/fixtures.js'
import { mustSkipShare, shareRefusal, shareableRailroads } from '../rules/shares.js'
import { supplyOf } from '../rules/supply.js'
import { HydratedSkipShare, SkipShare, isSkipShare } from './skipShare.js'
import { HydratedTakeShare, TakeShare, isTakeShare } from './takeShare.js'
import type { RailroadId } from '../data/railroads.js'

function takeShare(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId
): HydratedTakeShare {
    return new HydratedTakeShare({
        id: `a${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.TakeShare,
        playerId,
        railroadId
    })
}

function skipShare(state: HydratedRideTheRailsGameState, playerId: string): HydratedSkipShare {
    return new HydratedSkipShare({
        id: `s${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.System,
        type: ActionType.SkipShare,
        playerId
    })
}

// The p1 to p3 shares that leave Red and Blue with an empty supply in round 1.
const RED_AND_BLUE_TAKEN = {
    p1: { 'railroad.red': 27 },
    p2: { 'railroad.blue': 20 },
    p3: { 'railroad.blue': 7 }
} as const

describe('TakeShare (R-3.1, R-1.4, R-1.1)', () => {
    it('is registered as the phase 1 user action and hydrates', () => {
        expect(RideTheRailsApiActions[ActionType.TakeShare]).toBe(TakeShare)
        const state = buildState()
        const hydrated = new RideTheRailsHydrator().hydrateAction(
            takeShare(state, 'p3', 'railroad.red').dehydrate()
        )
        expect(hydrated).toBeInstanceOf(HydratedTakeShare)
        expect(isTakeShare(hydrated)).toBe(true)
    })

    it('adds one share of the railroad to the player (R-3.1)', () => {
        const state = buildState()
        expect(HydratedTakeShare.canTakeShare(state, 'p3')).toBe(true)
        takeShare(state, 'p3', 'railroad.blue').apply(state)
        expect(state.getPlayerState('p3').shares).toEqual({ 'railroad.blue': 1 })
        expect(supplyOf(state, 'railroad.blue')).toBe(26)
        for (const playerId of ['p1', 'p2']) {
            expect(state.getPlayerState(playerId).shares).toEqual({})
        }
    })

    it('writes the player’s shares and the supply left in metadata', () => {
        const state = buildState({ shares: { p3: { 'railroad.red': 2 } } })
        const action = takeShare(state, 'p3', 'railroad.red')
        action.apply(state)
        expect(action.metadata).toEqual({ shares: 3, supplyLeft: 24 })
    })

    it('has no cap on one railroad’s shares (R-3.1)', () => {
        const state = buildState({ round: 6, shares: { p3: { 'railroad.red': 25 } } })
        const action = takeShare(state, 'p3', 'railroad.red')
        action.apply(state)
        expect(state.getPlayerState('p3').sharesOf('railroad.red')).toBe(26)
        expect(action.metadata).toEqual({ shares: 26, supplyLeft: 1 })
    })

    it('may take a railroad the player already holds alongside others (R-3.1.4)', () => {
        const state = buildState({
            round: 2,
            shares: { p3: { 'railroad.red': 1, 'railroad.blue': 2 } }
        })
        takeShare(state, 'p3', 'railroad.orange').apply(state)
        expect(state.getPlayerState('p3').shares).toEqual({
            'railroad.red': 1,
            'railroad.blue': 2,
            'railroad.orange': 1
        })
    })

    it('refuses a railroad that is not available yet (R-1.4)', () => {
        const state = buildState({ round: 2 })
        expect(shareRefusal(state, 'railroad.yellow')).toBe('not-available')
        expect(shareRefusal(state, 'railroad.orange')).toBeUndefined()
        const before = state.dehydrate()
        expect(() => takeShare(state, 'p3', 'railroad.yellow').apply(state)).toThrow(
            /not-available/
        )
        expect(state.dehydrate()).toEqual(before)
    })

    it('refuses a railroad whose supply is empty (R-1.1)', () => {
        const state = buildState({
            shares: { p1: { 'railroad.red': 20 }, p2: { 'railroad.red': 6 } },
            track: { 'hex.usa.6-60': ['railroad.red'] }
        })
        expect(supplyOf(state, 'railroad.red')).toBe(0)
        expect(shareRefusal(state, 'railroad.red')).toBe('empty-supply')
        expect(shareableRailroads(state)).toEqual(['railroad.blue'])
        expect(() => takeShare(state, 'p3', 'railroad.red').apply(state)).toThrow(/empty-supply/)
        expect(state.getPlayerState('p3').shares).toEqual({})
    })

    it('takes the last locomotive of a supply (R-1.1)', () => {
        const state = buildState({ shares: { p1: { 'railroad.red': 26 } } })
        const action = takeShare(state, 'p3', 'railroad.red')
        action.apply(state)
        expect(action.metadata).toEqual({ shares: 1, supplyLeft: 0 })
        expect(shareRefusal(state, 'railroad.red')).toBe('empty-supply')
    })

    it('refuses a player whose turn it is not', () => {
        const state = buildState()
        expect(HydratedTakeShare.canTakeShare(state, 'p1')).toBe(false)
        expect(() => takeShare(state, 'p1', 'railroad.red').apply(state)).toThrow(/not your turn/)
    })

    it('refuses outside phase 1 (R-3.1)', () => {
        const state = buildState({ phase: PhaseName.Build, shares: { p1: { 'railroad.red': 1 } } })
        expect(HydratedTakeShare.canTakeShare(state, 'p1')).toBe(false)
        expect(() => takeShare(state, 'p1', 'railroad.red').apply(state)).toThrow(/phase 1/)
    })

    it('is not offered when every available supply is empty (R-3.1)', () => {
        const state = buildState({ shares: RED_AND_BLUE_TAKEN })
        expect(HydratedTakeShare.canTakeShare(state, 'p3')).toBe(false)
    })
})

describe('SkipShare (R-3.1)', () => {
    it('is a system action, kept out of the API actions, and hydrates', () => {
        expect(Object.values(RideTheRailsApiActions)).not.toContain(SkipShare)
        const state = buildState({ shares: RED_AND_BLUE_TAKEN })
        const hydrated = new RideTheRailsHydrator().hydrateAction(
            skipShare(state, 'p3').dehydrate()
        )
        expect(hydrated).toBeInstanceOf(HydratedSkipShare)
        expect(isSkipShare(hydrated)).toBe(true)
    })

    it('is due only when every available railroad’s supply is empty', () => {
        expect(mustSkipShare(buildState())).toBe(false)
        expect(mustSkipShare(buildState({ shares: { p1: { 'railroad.red': 27 } } }))).toBe(false)
        expect(mustSkipShare(buildState({ shares: RED_AND_BLUE_TAKEN }))).toBe(true)
        // Orange arrives in round 2 with a full supply.
        expect(mustSkipShare(buildState({ round: 2, shares: RED_AND_BLUE_TAKEN }))).toBe(false)
    })

    it('counts track against the supply (R-1.1)', () => {
        const state = buildState({
            shares: { p1: { 'railroad.red': 26 }, p2: { 'railroad.blue': 25 } },
            track: {
                'hex.usa.6-60': ['railroad.red', 'railroad.blue'],
                'hex.usa.6-58': ['railroad.blue']
            }
        })
        expect(mustSkipShare(state)).toBe(true)
    })

    it('takes nothing and says why in metadata', () => {
        const state = buildState({ shares: RED_AND_BLUE_TAKEN })
        const before = state.dehydrate()
        const action = skipShare(state, 'p3')
        action.apply(state)
        expect(action.metadata).toEqual({
            reason: 'every-supply-empty',
            railroadIds: ['railroad.red', 'railroad.blue']
        })
        expect(state.dehydrate()).toEqual(before)
    })

    it('is refused while a share can still be taken', () => {
        const state = buildState({ shares: { p1: { 'railroad.red': 27 } } })
        expect(() => skipShare(state, 'p3').apply(state)).toThrow(/can still be taken/)
    })

    it('is refused for a player whose turn it is not', () => {
        const state = buildState({ shares: RED_AND_BLUE_TAKEN })
        expect(() => skipShare(state, 'p1').apply(state)).toThrow(/turn/)
    })
})

function userShare(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId
): TakeShare {
    return {
        id: `a${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.TakeShare,
        playerId,
        railroadId
    }
}

describe('undo of a share (R-5)', () => {
    it('restores the state exactly', () => {
        const hydrated = buildState({ round: 3, shares: { p3: { 'railroad.red': 1 } } })
        const state = hydrated.dehydrate()
        const result = engine.executeCanonicalAction({
            game: createGame(3),
            state,
            action: userShare(hydrated, 'p3', 'railroad.red')
        })
        const [processed] = result.processedActions
        expect(result.processedActions).toHaveLength(1)
        expect(processed.revealsInfo).toBeUndefined()
        expect(result.updatedState.players.find((p) => p.playerId === 'p3')?.shares).toEqual({
            'railroad.red': 2
        })
        const undone = engine.undoProcessedAction({
            state: result.updatedState,
            action: processed
        })
        expect(undone).toEqual(state)
    })

    it('is the player’s to take back until the next player acts', () => {
        const state = buildState()
        const p3Share = { ...userShare(state, 'p3', 'railroad.red'), index: 0 }
        const p2Share = { ...userShare(state, 'p2', 'railroad.blue'), index: 1 }
        expect(latestPlayerUndoTarget([p3Share], 'p3')).toBe(p3Share)
        expect(latestPlayerUndoTarget([p3Share, p2Share], 'p3')).toBeUndefined()
        expect(latestPlayerUndoTarget([p3Share, p2Share], 'p2')).toBe(p2Share)
    })
})
