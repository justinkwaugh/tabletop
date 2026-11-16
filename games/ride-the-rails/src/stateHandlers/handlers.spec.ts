import { ActionSource, GameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { buildState, hydrated, runAction } from '../testing/fixtures.js'
import { offersByPlayer } from '../testing/offers.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const BETWEEN_NEW_YORK_AND_PHILADELPHIA: HexId = 'hex.usa.6-58'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const RED_NEW_YORK_TO_PHILADELPHIA = {
    [NEW_YORK]: ['railroad.red' as const],
    [BETWEEN_NEW_YORK_AND_PHILADELPHIA]: ['railroad.red' as const],
    [PHILADELPHIA]: ['railroad.red' as const]
}

function processedOf(run: ReturnType<typeof runAction>) {
    return run.processed.map(({ type, playerId, source }) => ({ type, playerId, source }))
}

describe('TakingShares (R-3.1, R-1.1)', () => {
    it('skips, by itself, each turn that finds every supply empty', () => {
        const state = buildState({
            shares: { p1: { 'railroad.red': 26 }, p2: { 'railroad.blue': 27 } }
        })
        const run = runAction(state, {
            type: ActionType.TakeShare,
            playerId: 'p3',
            railroadId: 'railroad.red'
        })
        expect(processedOf(run).slice(0, 3)).toEqual([
            { type: ActionType.TakeShare, playerId: 'p3', source: ActionSource.User },
            { type: ActionType.SkipShare, playerId: 'p2', source: ActionSource.System },
            { type: ActionType.SkipShare, playerId: 'p1', source: ActionSource.System }
        ])
    })

    it('offers TakeShare to the player whose turn it is, and nothing to anyone else', () => {
        expect(offersByPlayer(buildState().dehydrate())).toEqual({
            p1: [],
            p2: [],
            p3: [ActionType.TakeShare]
        })
    })
})

describe('Building (R-3.2.1, R-3.2.3, R-3.2.4)', () => {
    it('finishes, by itself, each building turn that opens with nothing legal', () => {
        const state = buildState({
            shares: { p1: { 'railroad.red': 26 }, p2: { 'railroad.blue': 27 } }
        })
        const run = runAction(state, {
            type: ActionType.TakeShare,
            playerId: 'p3',
            railroadId: 'railroad.red'
        })
        expect(processedOf(run).slice(3, 6)).toEqual(
            ['p1', 'p2', 'p3'].map((playerId) => ({
                type: ActionType.FinishBuilding,
                playerId,
                source: ActionSource.System
            }))
        )
        expect(run.after.building).toBeUndefined()
        // With no track there is no journey either, so the Ride phase passes by itself (R-3.3.1).
        expect(processedOf(run).slice(6, 9)).toEqual(
            ['p1', 'p2', 'p3'].map((playerId) => ({
                type: ActionType.PassJourney,
                playerId,
                source: ActionSource.System
            }))
        )
        expect(run.after.machineState).toBe(MachineState.TakingShares)
    })

    it('keeps the builder’s turn open after a placement that leaves more legal', () => {
        const state = buildState({ phase: PhaseName.Build, shares: { p1: { 'railroad.red': 1 } } })
        const run = runAction(state, {
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: 'railroad.red',
            hexId: NEW_YORK
        })
        expect(run.processed).toHaveLength(1)
        expect(run.after.machineState).toBe(MachineState.Building)
        expect(run.after.activePlayerIds).toEqual(['p1'])
        expect(offersByPlayer(run.after)).toEqual({
            p1: [ActionType.PlaceLocomotive, ActionType.EndBuilding],
            p2: [],
            p3: []
        })
    })

    it('refuses an illegal placement before it is applied', () => {
        const state = buildState({ phase: PhaseName.Build, shares: { p1: { 'railroad.red': 1 } } })
        expect(() =>
            runAction(state, {
                type: ActionType.PlaceLocomotive,
                playerId: 'p1',
                railroadId: 'railroad.blue',
                hexId: NEW_YORK
            })
        ).toThrow(/not valid in state Building/)
    })
})

describe('Riding (R-3.3.1)', () => {
    it('offers the journey, and not the pass, while one exists', () => {
        const state = buildState({
            phase: PhaseName.Ride,
            shares: { p1: { 'railroad.red': 1 } },
            track: RED_NEW_YORK_TO_PHILADELPHIA
        })
        expect(offersByPlayer(state.dehydrate())).toEqual({
            p1: [ActionType.RideJourney],
            p2: [],
            p3: []
        })
    })

    it('offers no one the pass: with no journey the pass is taken by itself', () => {
        const state = buildState({ phase: PhaseName.Ride, currentPlayerId: 'p2' })
        expect(offersByPlayer(state.dehydrate())).toEqual({ p1: [], p2: [], p3: [] })
    })

    it('passes every later player by itself too, since no journey exists for them either', () => {
        const run = runAction(buildState({ phase: PhaseName.Ride }), {
            type: ActionType.PassJourney,
            playerId: 'p1'
        })
        expect(processedOf(run).slice(1, 3)).toEqual(
            ['p2', 'p3'].map((playerId) => ({
                type: ActionType.PassJourney,
                playerId,
                source: ActionSource.System
            }))
        )
        expect(run.after.machineState).toBe(MachineState.TakingShares)
    })
})

describe('EndingRound and Ended (R-2.5, R-6.1)', () => {
    it('ends rounds 1 to 5 with the end of round, in the last pass’s cascade', () => {
        const state = buildState({ round: 5, phase: PhaseName.Ride, currentPlayerId: 'p3' })
        const run = runAction(state, { type: ActionType.PassJourney, playerId: 'p3' })
        expect(processedOf(run)).toEqual([
            { type: ActionType.PassJourney, playerId: 'p3', source: ActionSource.User },
            { type: ActionType.EndRound, playerId: undefined, source: ActionSource.System }
        ])
        expect(run.after.machineState).toBe(MachineState.TakingShares)
        expect(run.after.roundManager.series.at(-1)).toMatchObject({ number: 6 })
        expect(run.after.phaseManager.series.at(-1)).toMatchObject({ name: PhaseName.TakeShare })
    })

    it('ends the game after round 6 instead, in the last pass’s cascade', () => {
        const state = buildState({
            round: 6,
            phase: PhaseName.Ride,
            currentPlayerId: 'p3',
            money: { p1: 30, p2: 41, p3: 12 }
        })
        const run = runAction(state, { type: ActionType.PassJourney, playerId: 'p3' })
        expect(run.processed.map((action) => action.type)).toEqual([
            ActionType.PassJourney,
            ActionType.EndGame
        ])
        expect(run.after.machineState).toBe(MachineState.Ended)
        expect(run.after.result).toBe(GameResult.Win)
        expect(run.after.winningPlayerIds).toEqual(['p2'])
        expect(run.after.activePlayerIds).toEqual([])
        expect(hydrated(run.after).roundManager.currentRound).toBeUndefined()
        expect(hydrated(run.after).phaseManager.currentPhase).toBeUndefined()
        expect(offersByPlayer(run.after)).toEqual({ p1: [], p2: [], p3: [] })
    })
})
