import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    GameResult,
    type GameAction,
    assert,
    assertExists,
    validateGameResult
} from '@tabletop/common'
import { MapId } from '../maps/types.js'
import { sarMap } from '../maps/maps.js'
import { ACTION_BOXES, ActionBox } from '../model/actionBoxes.js'
import type { SarGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { SarRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(SarRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function playToEnd(count: number, mapId: MapId): SarGameState {
    const game = createGame(count, mapId)
    let state = engine.startGame(game, { masterSeed }).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(SarRuntime.hydrator.hydrateState(state), playerId, step)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

describe.each(
    Object.values(MapId).flatMap((mapId) => [3, 4, 5, 6].map((count) => ({ mapId, count })))
)('a $count player game on $mapId', ({ mapId, count }) => {
    it('plays through every payout to a declared result', () => {
        const finished = playToEnd(count, mapId)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.dividendsPaid).toBe(sarMap(mapId).definition.dividendsBeforeFinal + 1)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(finished.railroads.every((railroad) => railroad.treasury === 0)).toBe(true)
        const [firstOffered] = sarMap(mapId).initialOffering
        expect(
            finished.railroads.find((r) => r.id === firstOffered)?.owners.length
        ).toBeGreaterThan(0)

        const scores = SarRuntime.scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count, mapId)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })

    it('replays and undoes every processed action', () => {
        const game = createGame(count, mapId)
        const initial = engine.startGame(game, { masterSeed }).initialState
        const history: { action: GameAction; before: SarGameState }[] = []
        let state = initial
        for (let step = 0; state.result === undefined; step++) {
            assert(step < 5000, 'Playthrough did not finish')
            const [playerId] = state.activePlayerIds
            const action = botAction(SarRuntime.hydrator.hydrateState(state), playerId, step)
            const result = engine.executeCanonicalAction({ game, state, action })
            let replay = state
            for (const processed of result.processedActions) {
                history.push({ action: processed, before: replay })
                replay = engine.applyProcessedAction({ game, state: replay, action: processed })
            }
            expect(replay).toEqual(result.updatedState)
            state = result.updatedState
        }
        let undone = state
        for (const { action, before } of history.toReversed()) {
            undone = engine.undoProcessedAction({ state: undone, action })
            expect(undone).toEqual(before)
        }
        expect(undone).toEqual(initial)
    })

    it('keeps every action box within its capacity', () => {
        const game = createGame(count, mapId)
        let state = engine.startGame(game, { masterSeed }).initialState
        for (let step = 0; state.result === undefined; step++) {
            const hydrated = SarRuntime.hydrator.hydrateState(state)
            for (const box of ACTION_BOXES.filter((b) => b !== ActionBox.ConstructTrack)) {
                expect(hydrated.locomotivesIn(box)).toBeLessThanOrEqual(
                    box === ActionBox.PayDividends
                        ? 1
                        : box === ActionBox.DevelopSettlements
                          ? 2
                          : 3
                )
            }
            const [playerId] = state.activePlayerIds
            state = engine.executeCanonicalAction({
                game,
                state,
                action: botAction(hydrated, playerId, step)
            }).updatedState
        }
    })
})
