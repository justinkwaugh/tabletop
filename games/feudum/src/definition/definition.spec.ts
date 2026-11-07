import {
    assert,
    assertExists,
    GameResult,
    reportGameProgress,
    validateGameResult,
    type GameProgress
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RegionIds, type RegionId, type TileId } from '../data/regionTiles.js'
import { LastEpoch, type Epoch } from '../data/tracks.js'
import { FeudumCanonicalStateValidator } from '../model/canonicalValidator.js'
import type { FeudumProjectedState } from '../model/gameState.js'
import { setBarrel } from '../testing/charters.js'
import { rowOf, scoreFrom } from '../testing/gameEnd.js'
import { canonicalState, initialState } from '../testing/state.js'
import { walkGame } from '../testing/walk.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumColors } from './colors.js'
import { Definition } from './definition.js'
import { FeudumHydrator } from './hydrator.js'
import { FeudumInfo } from './info.js'
import { FeudumGameInitializer } from './initializer.js'
import { FeudumProgression } from './progression.js'
import { FeudumRuntime } from './runtime.js'
import { FeudumScoring } from './scoring.js'
import { FeudumStateHandlers } from './stateHandlers.js'

/** A seed whose game ends on a stack emptied mid-round. */
const WalkSeed = '00000000000000000000000000000012'
const Numerals = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv' } as const
const projector = FeudumRuntime.visibility.state
/** Every state of a whole game through every view is slow; these show the same thing. */
const ViewEvery = 20

type StackTopShown = 1 | 2 | 3 | 4 | 'V'

interface ProgressCase {
    readonly why: string
    readonly epoch: Epoch
    readonly rounds: number
    readonly tops: readonly StackTopShown[]
    readonly fraction: number
    readonly label: string
}

const ProgressCases: readonly ProgressCase[] = [
    {
        why: 'the first sunray lies ahead',
        epoch: 1,
        rounds: 1,
        tops: [1, 1, 1, 1, 1, 1],
        fraction: 0,
        label: 'Epoch I · Round 1'
    },
    {
        why: 'two of the four tops II asks for',
        epoch: 1,
        rounds: 2,
        tops: [2, 2, 1, 1, 1, 1],
        fraction: 0.125,
        label: 'Epoch I · Round 2'
    },
    {
        why: 'more tops than asked for count as the sunray met',
        epoch: 1,
        rounds: 3,
        tops: [2, 2, 2, 2, 2, 2],
        fraction: 0.25,
        label: 'Epoch I · Round 3'
    },
    {
        why: 'two of the three tops III asks for',
        epoch: 2,
        rounds: 4,
        tops: [3, 3, 2, 2, 2, 2],
        fraction: 0.417,
        label: 'Epoch II · Round 4'
    },
    {
        why: 'one of the two tops IV asks for',
        epoch: 3,
        rounds: 7,
        tops: [4, 3, 3, 3, 3, 3],
        fraction: 0.625,
        label: 'Epoch III · Round 7'
    },
    {
        why: 'no stack has emptied',
        epoch: 4,
        rounds: 9,
        tops: [4, 4, 4, 4, 4, 4],
        fraction: 0.75,
        label: 'Epoch IV · Round 9'
    }
]

function report(state: FeudumProjectedState): GameProgress {
    const progress = reportGameProgress(FeudumRuntime, state)
    assertExists(progress, 'Feudum reports Game Progress')
    return progress
}

describe('The definition', () => {
    it('R-2.1 names the title and its player counts', () => {
        expect(Definition.info).toBe(FeudumInfo)
        expect(FeudumInfo.id).toBe('feudum')
        expect(FeudumInfo.metadata).toMatchObject({
            name: 'Feudum',
            bggId: 163839,
            hasScores: true,
            minPlayers: 2,
            maxPlayers: 5
        })
    })

    it('R-X.2 uses the versioned randomness: a master seed and a protected stream', () => {
        expect(Definition.runtime.randomnessVersion).toBe(1)
    })

    it('R-2.2, R-X.1 registers what the engine and the host run on', () => {
        const { runtime } = Definition

        expect(runtime.initializer).toBeInstanceOf(FeudumGameInitializer)
        expect(runtime.hydrator).toBeInstanceOf(FeudumHydrator)
        expect(runtime.playerColors).toBe(FeudumColors)
        expect(runtime.canonicalStateValidator).toBe(FeudumCanonicalStateValidator)
        expect(runtime.apiActions).toBe(FeudumApiActions)
        expect(runtime.stateHandlers).toBe(FeudumStateHandlers)
        expect(runtime.scoring).toBeInstanceOf(FeudumScoring)
        expect(runtime.progression).toBeInstanceOf(FeudumProgression)
    })

    it('R-1.4.7 takes assigned starting positions', () => {
        expect(Definition.runtime.initializer.supportsStartingPositions).toBe(true)
    })

    it('R-1.1 the registered validator checks shape and component totals', () => {
        const { canonicalStateValidator: validator } = Definition.runtime
        const state = canonicalState()

        expect(validator?.Check(state)).toBe(true)
        expect(validator?.Check({ ...state, supply: { ...state.supply, shillings: -1 } })).toBe(
            false
        )
    })
})

describe('R-6.3 final scores and results', () => {
    it.each([
        {
            why: 'most vp',
            scores: [20, 10, 5],
            barrels: [0, 3, 3],
            winners: [0],
            result: GameResult.Win
        },
        {
            why: 'tied on vp, the barrel decides',
            scores: [20, 20, 5],
            barrels: [1, 2, 3],
            winners: [1],
            result: GameResult.Win
        },
        {
            why: 'tied on vp and barrels, shared',
            scores: [20, 20, 5],
            barrels: [2, 2, 3],
            winners: [0, 1],
            result: GameResult.Draw
        },
        {
            why: 'every seat tied, shared',
            scores: [7, 7, 7],
            barrels: [1, 1, 1],
            winners: [0, 1, 2],
            result: GameResult.Draw
        }
    ])('R-6.3 $why', ({ scores, barrels, winners, result }) => {
        const { table, order, metadata } = scoreFrom((state, seats) => {
            seats.forEach((seat, index) => {
                state.getPlayerState(seat).score = scores[index]
                setBarrel(state, seat, barrels[index])
            })
        })

        expect(() => validateGameResult(table.state)).not.toThrow()
        expect(table.state.result).toBe(result)
        expect(table.state.winningPlayerIds.toSorted()).toEqual(
            winners.map((index) => order[index]).toSorted()
        )
        expect(FeudumRuntime.scoring.finalScores(table.state)).toEqual(
            Object.fromEntries(order.map((seat) => [seat, rowOf(metadata, seat).score]))
        )
    })

    it('R-6.3 a seat that loses only on the barrel carries the top score', () => {
        const { table, order } = scoreFrom((state, [loser, winner]) => {
            state.getPlayerState(loser).score = 20
            state.getPlayerState(winner).score = 20
            setBarrel(state, winner, 3)
        })
        const finalScores = FeudumRuntime.scoring.finalScores(table.state)

        expect(table.state.winningPlayerIds).toEqual([order[1]])
        expect(finalScores[order[0]]).toBe(finalScores[order[1]])
    })
})

describe('Game Progress', () => {
    /** One entry per region, left to right: the epoch of its top tile, or 'V' for an empty stack. */
    function atTable(
        epoch: Epoch,
        rounds: number,
        tops: readonly StackTopShown[]
    ): FeudumProjectedState {
        const state = initialState()
        state.epoch = epoch
        for (let round = 0; round < rounds; round += 1) {
            state.roundManager.startRound(round)
        }
        RegionIds.forEach((region: RegionId, index) => {
            const top = tops[index]
            const tileId: TileId | undefined =
                top === 'V' ? undefined : `tile.${region}.${Numerals[top]}`
            state.regionStacks[region] = tileId ? [tileId] : []
        })
        return state.dehydrate()
    }

    it('R-1.4.7 starts at nothing, in setup', () => {
        expect(report(initialState().dehydrate())).toEqual({
            fraction: 0,
            label: 'Epoch I · Setup'
        })
    })

    it.each(ProgressCases)('R-4.11.2 $why', ({ epoch, rounds, tops, fraction, label }) => {
        expect(report(atTable(epoch, rounds, tops))).toEqual({ fraction, label })
    })

    it('R-6.1-H1 final as soon as a stack empties, with the round still to finish', () => {
        expect(report(atTable(4, 9, [4, 'V', 4, 4, 4, 4]))).toEqual({
            fraction: 1,
            label: 'Epoch IV · Round 9',
            final: true
        })
    })

    it('R-6.1 final at epoch V', () => {
        expect(report(atTable(LastEpoch, 10, [4, 'V', 4, 4, 4, 4]))).toEqual({
            fraction: 1,
            label: 'Epoch V · Round 10',
            final: true
        })
    })

    describe.each([2, 3, 4, 5])('through a whole game with %i players', (count) => {
        const walk = walkGame(WalkSeed, count)
        const states = [walk.initial, ...walk.steps.flatMap(({ after }) => after)]
        const reports = states.map(report)
        const hasEmptyStack = ({ regionStacks }: FeudumProjectedState) =>
            Object.values(regionStacks).some((stack) => stack.length === 0)

        it('R-4.11.2, R-6.1 never moves backwards, and ends at the whole', () => {
            reports.forEach((progress, index) => {
                expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
            })
            expect(reports[0].fraction).toBe(0)
            expect(reports.at(-1)).toMatchObject({ fraction: 1, final: true })
        })

        it('R-6.1 is final exactly once V is met', () => {
            states.forEach((state, index) => {
                const met = state.epoch === LastEpoch || hasEmptyStack(state)
                expect(reports[index].final === true).toBe(met)
            })
        })

        it('R-2.1, R-2.2 names the epoch and the round', () => {
            states.forEach((state, index) => {
                const round = state.roundManager.series.length
                expect(reports[index].label).toMatch(
                    round === 0 ? /^Epoch I · Setup$/ : new RegExp(`^Epoch [IV]+ · Round ${round}$`)
                )
            })
        })

        it('R-1.4-H2, R-4.11.2 reports the same to every view: public information only', () => {
            const perspectives = [
                { kind: 'spectator' } as const,
                ...walk.game.players.map(({ id }) => ({ kind: 'player', playerId: id }) as const)
            ]
            states.forEach((state, index) => {
                if (index % ViewEvery !== 0 && index !== states.length - 1) {
                    return
                }
                assert(FeudumCanonicalStateValidator.Check(state), 'A host state is canonical')
                for (const perspective of perspectives) {
                    const view = projector.project(state, perspective, {
                        config: walk.game.config
                    })
                    expect(report(view)).toEqual(reports[index])
                }
            })
        })
    })
})
