import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    GameProgress,
    GameResult,
    type Game,
    type GameAction,
    assert,
    assertExists,
    reportGameProgress,
    validateGameResult
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { isLayTrack } from '../actions/layTrack.js'
import { edition as editionOf } from '../editions/editions.js'
import { EditionId } from '../editions/types.js'
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

function playToEnd(
    count: number,
    config: Record<string, boolean | string> = {},
    onState: (state: RailheadsProjectedState) => void = () => {}
): Played {
    const game = createGame(count, config)
    const initial = engine.startGame(game, { masterSeed }).initialState
    const history: GameAction[] = []
    let state = initial
    onState(state)
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(RailheadsRuntime.hydrator.hydrateState(state), playerId, step)
        const result = engine.executeCanonicalAction({ game, state, action })
        history.push(...result.processedActions)
        state = result.updatedState
        onState(state)
    }
    return { game, initial, history, final: state }
}

const TABLES = Object.values(EditionId).flatMap((edition) =>
    [3, 4, 5].map((count) => ({ edition, count }))
)

describe.each(TABLES)('a $count player game of $edition', ({ edition, count }) => {
    const config = { edition }

    it('plays four rounds to a declared result', () => {
        const { final, history } = playToEnd(count, config)
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
        const again = playToEnd(count, config).final
        expect({ ...again, id: final.id }).toEqual(final)
    })

    it('reports Game Progress through the opening auction and the rounds to a final last round', () => {
        const { rounds, roundTimer } = editionOf(edition).definition
        const reports: GameProgress[] = []
        playToEnd(count, config, (state) => {
            const progress = reportGameProgress(RailheadsRuntime, state)
            assertExists(progress, 'Railheads reports Game Progress')
            expect(Value.Check(GameProgress, progress)).toBe(true)
            reports.push(progress)
        })
        expect(reports[0]).toEqual({ fraction: 0, label: 'Opening auction' })
        for (const [index, report] of reports.entries())
            expect(report.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        const labels = reports.map((report) => report.label)
        expect(labels).toContain(`Round 1 of ${rounds} · ${roundTimer[count]} left`)
        expect(labels).toContain(`Round ${rounds - 1} of ${rounds} · 0 left`)
        expect(reports.some((report) => report.final)).toBe(true)
        for (const report of reports)
            expect(report.final === true).toBe(report.label.startsWith('Last round · '))
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last round · 0 left', final: true })
    })

    it('replays and undoes every processed action', () => {
        const { game, initial, history, final } = playToEnd(count, config)
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

describe.each(Object.values(EditionId))('Off the Rails in %s', (edition) => {
    it('plays to the end choosing how industries develop', () => {
        const { final, history } = playToEnd(4, { edition, offTheRails: true })
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
