import { GameProgress, assert, assertExists, reportGameProgress } from '@tabletop/common'
import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { EndTurn } from '../actions/endTurn.js'
import { BOARD_GRID, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { isRedTile } from '../components/townTiles.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { withBagLeft, withEmptyBag, withTrack } from '../testing/fixtures.js'
import { play } from '../testing/play.js'
import { SeededPlayer } from '../testing/seededPlayer.js'
import { VARIANT_OFF_AND_ON, canonical, engine, startGame } from '../testing/startGame.js'
import { withPlacingEnded } from '../testing/turnPieces.js'
import { turnPlayer } from '../testing/turns.js'
import { PromontoryPointRuntime } from './runtime.js'
import { MachineState } from './states.js'

const ACTION_LIMIT = 2000

function progressOf(state: PromontoryPointGameState): GameProgress {
    const progress = reportGameProgress(PromontoryPointRuntime, state)
    assertExists(progress, 'Promontory Point reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

// R-1.3 step 6, R-5: what no seat may see, wiped: the bag's order and every hand.
function withHiddenWiped(state: PromontoryPointGameState): PromontoryPointGameState {
    return {
        ...state,
        bag: { ...state.bag, items: [] },
        players: state.players.map((player) => ({ ...player, hand: [] }))
    }
}

describe('Promontory Point Game Progress', () => {
    it("R-1.3, R-6.1: a new game reports the bag's count and all 16 red tiles uncovered", () => {
        const { state } = startGame({ playerCount: 4 })
        expect(progressOf(state)).toEqual({
            fraction: 0,
            label: `Bag ${state.bag.remaining} · 16 red tiles uncovered`
        })
    })

    it('R-6.1-H2: an emptied bag makes this turn the last', () => {
        const { game, state } = startGame({ playerCount: 3 })
        const lastTurn = withEmptyBag(state)
        expect(progressOf(lastTurn)).toEqual({ fraction: 1, label: 'Last turn', final: true })

        const ending = withPlacingEnded(lastTurn)
        const ended = play(game, ending, EndTurn, { playerId: turnPlayer(ending) }).state
        expect(ended.machineState).toBe(MachineState.EndOfGame)
        expect(progressOf(ended)).toEqual({ fraction: 1, label: 'Last turn', final: true })
    })

    it('R-6.1-H1: counts one red tile uncovered in the singular', () => {
        const { state } = startGame({ playerCount: 2 })
        const redTowns = BOARD_GRID.spaces()
            .map(({ spaceId }) => spaceId)
            .filter((spaceId) => spaceId in state.towns && isRedTile(state.towns[spaceId]))
        const oneLeft = withTrack(
            state,
            redTowns
                .slice(1)
                .map((spaceId, index): [SpaceId, RailroadId] => [
                    spaceId,
                    RAILROAD_IDS[index % RAILROAD_IDS.length]
                ])
        )
        expect(progressOf(oneLeft).label).toBe(
            `Bag ${oneLeft.bag.remaining} · 1 red tile uncovered`
        )
        expect(progressOf(oneLeft).final).toBeUndefined()
    })

    it.each(VARIANT_OFF_AND_ON)(
        'R-6.1, R-6.3: with one piece left in the bag the pieces measure is one piece short of full (config %j)',
        (config) => {
            const { state: initial } = startGame({ playerCount: 3, config })
            // Every piece drawn from the bag since setup has been used, so the pieces to use are
            // the bag's count at setup, whatever each seat holds (3, or 4 in the variant).
            const piecesToUse = initial.bag.remaining
            const lastPiece = withBagLeft(initial, 1)
            expect(progressOf(lastPiece).fraction).toBe(
                Math.round(((piecesToUse - 1) / piecesToUse) * 1000) / 1000
            )
        }
    )

    describe.each(VARIANT_OFF_AND_ON)('a seeded game (config %j)', (config) => {
        it('R-6.1: never goes backwards, reads nothing hidden, and is final from the last turn on', () => {
            const { game, state: initial } = startGame({ playerCount: 3, config })
            const player = new SeededPlayer(config.fourPieceVariant === true ? 7 : 5)
            const reports: GameProgress[] = [progressOf(initial)]
            let state = initial
            for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
                assert(step < ACTION_LIMIT, 'A seeded game ends')
                state = canonical(
                    engine.executeCanonicalAction({
                        game,
                        state,
                        action: player.nextAction(game, state)
                    }).updatedState
                )
                const progress = progressOf(state)
                expect(PromontoryPointRuntime.progression.progress(withHiddenWiped(state))).toEqual(
                    PromontoryPointRuntime.progression.progress(state)
                )
                reports.push(progress)
            }
            for (const [index, progress] of reports.entries()) {
                expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
            }
            const firstFinal = reports.findIndex((progress) => progress.final === true)
            expect(firstFinal).toBeGreaterThan(0)
            expect(reports.slice(firstFinal).every((progress) => progress.final === true)).toBe(
                true
            )
            expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last turn', final: true })
        })
    })
})
