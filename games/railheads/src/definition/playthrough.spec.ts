import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    GameResult,
    type Game,
    type GameAction,
    assert,
    assertExists,
    validateGameResult
} from '@tabletop/common'
import { isLayTrack } from '../actions/layTrack.js'
import type { RailheadsProjectedState } from '../model/gameState.js'
import { IndustryBoost } from '../model/track.js'
import { botAction, createGame } from '../testing/bot.js'
import { ActionType } from './actions.js'
import { RailheadsRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(RailheadsRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

type Played = {
    game: Game
    initial: RailheadsProjectedState
    history: GameAction[]
    final: RailheadsProjectedState
}

function playToEnd(count: number, config: Record<string, boolean | string> = {}): Played {
    const game = createGame(count, config)
    const initial = engine.startGame(game, { masterSeed }).initialState
    const history: GameAction[] = []
    let state = initial
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(RailheadsRuntime.hydrator.hydrateState(state), playerId, step)
        const result = engine.executeCanonicalAction({ game, state, action })
        history.push(...result.processedActions)
        state = result.updatedState
    }
    return { game, initial, history, final: state }
}

describe.each([3, 4, 5])('a %i player game', (count) => {
    it('plays four rounds to a declared result', () => {
        const { final, history } = playToEnd(count)
        expect(final.machineState).toBe(MachineState.EndOfGame)
        expect(final.rounds.series).toHaveLength(4)
        expect([GameResult.Win, GameResult.Draw]).toContain(final.result)
        expect(() => validateGameResult(final)).not.toThrow()
        expect(history.filter((action) => action.type === ActionType.EndRound)).toHaveLength(4)
        expect(history.filter((action) => action.type === ActionType.ScoreGame)).toHaveLength(1)
        for (const type of [
            ActionType.IssueShare,
            ActionType.InvestInIndustry,
            ActionType.PlaceSealedBid,
            ActionType.LayTrack,
            ActionType.Consolidate
        ]) {
            expect(history.some((action) => action.type === type)).toBe(true)
        }
        const scores = RailheadsRuntime.scoring.finalScores(final)
        const best = Math.max(...Object.values(scores))
        expect(final.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count).final
        expect({ ...again, id: final.id }).toEqual(final)
    })

    it('replays and undoes every processed action', () => {
        const { game, initial, history, final } = playToEnd(count)
        const befores: RailheadsProjectedState[] = []
        let replay = initial
        for (const action of history) {
            befores.push(replay)
            replay = engine.applyProcessedAction({ game, state: replay, action })
        }
        expect(replay).toEqual(final)
        let undone = final
        for (let index = history.length - 1; index >= 0; index--) {
            undone = engine.undoProcessedAction({ state: undone, action: history[index] })
            expect(undone).toEqual(befores[index])
        }
        expect(undone).toEqual(initial)
    })
})

describe('Off the Rails', () => {
    it('plays to the end choosing how industries develop', () => {
        const { final, history } = playToEnd(4, { offTheRails: true })
        expect(final.offTheRails).toBe(true)
        expect(final.machineState).toBe(MachineState.EndOfGame)
        const effects = history.filter(isLayTrack).flatMap((action) =>
            action.placements.map((placement, index) => ({
                placement,
                effect: action.metadata?.effects[index]
            }))
        )
        const developed = effects.filter(
            ({ placement }) => placement.boost === IndustryBoost.Development
        )
        expect(developed.length).toBeGreaterThan(0)
        expect(developed.every(({ effect }) => effect?.revenueGain === 0)).toBe(true)
        expect(
            effects.some(
                ({ placement, effect }) =>
                    placement.boost === IndustryBoost.Revenue && (effect?.revenueGain ?? 0) > 0
            )
        ).toBe(true)
    })
})
