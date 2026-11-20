import {
    assert,
    GameEngine,
    GameResult,
    validateGameResult,
    type StartingPositionAssignment
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MinimumKnightRows } from '../data/guilds.js'
import { FeudumCanonicalStateValidator } from '../model/canonicalValidator.js'
import type { FeudumProjectedState } from '../model/gameState.js'
import type { KnightRowEntry } from '../model/knightRows.js'
import { knightRows, rowSeat } from '../model/knightRows.js'
import { testGame } from '../testing/state.js'
import { walkGame, withoutRowId, type GameWalk } from '../testing/walk.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FeudumRuntime)
const projector = FeudumRuntime.visibility.state
const MasterSeed = '0123456789abcdef0123456789abcdef'

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function assigned(order: readonly string[]): StartingPositionAssignment {
    return { playerIds: [...order] }
}

const byPlayerId = <T extends { playerId: string }>(rows: readonly T[]): T[] =>
    rows.toSorted((left, right) => left.playerId.localeCompare(right.playerId))

/** Everything but the seating: who sits where, who is asked first, and the rows laid out by seat. */
function withoutSeating(state: FeudumProjectedState) {
    const {
        players,
        turnManager: _turns,
        activePlayerIds: _active,
        flow,
        guilds,
        ...rest
    } = withoutRowId(state)
    const ownerKey = ({ rowId, row: { owner } }: KnightRowEntry) =>
        'playerId' in owner ? owner.playerId : rowId
    const rows = knightRows({ guilds })
        .toSorted((left, right) => ownerKey(left).localeCompare(ownerKey(right)))
        .map(({ row }) => row)
    return {
        ...rest,
        flow,
        guilds: { ...guilds, knight: { ...guilds.knight, rows } },
        players: byPlayerId(players)
    }
}

/** The seats asked, in order, while the machine stood in this state. */
function seatsAskedIn(walk: GameWalk, machineState: MachineState): string[] {
    return walk.steps
        .filter(({ before }) => before.machineState === machineState)
        .map(({ input }) => input.playerId)
}

/** Who led the cards in each round the walk reached. */
function firstToPlayByRound(walk: GameWalk): string[] {
    const leaders = new Map<number, string>()
    for (const { before, input } of walk.steps) {
        const round = before.roundManager.series.length
        if (before.machineState === MachineState.PlayingCards && !leaders.has(round)) {
            leaders.set(round, input.playerId)
        }
    }
    return [...leaders.values()]
}

describe.each([2, 3, 4, 5])('Feudum tournaments with %i players', (count) => {
    const game = testGame(count)
    const ids = game.players.map((player) => player.id)
    const walks = rotations(ids).map((order) => ({
        order,
        walk: walkGame(MasterSeed, count, undefined, assigned(order))
    }))
    const unassigned = engine.startGame(game, { masterSeed: MasterSeed }).initialState

    it('R-1.4.7 position 0 starts and the assignment is the clockwise order', () => {
        for (const order of rotations(ids)) {
            const { initialState } = engine.startGame(game, {
                masterSeed: MasterSeed,
                startingPositions: assigned(order)
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.players.map((player) => player.playerId)).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.ChoosingStartingGoods)
            expect(initialState.activePlayerIds).toEqual([order[0]])
        }
    })

    it('R-1.4.7, R-2.2.5 setup and cards follow the assignment, then the marker passes clockwise', () => {
        for (const { order, walk } of walks) {
            expect(seatsAskedIn(walk, MachineState.ChoosingStartingGoods)).toEqual(order)
            expect(seatsAskedIn(walk, MachineState.PlacingStartingPawn)).toEqual(order)
            firstToPlayByRound(walk).forEach((leader, round) => {
                expect(leader).toBe(order[round % count])
            })
        }
    })

    it('R-1.4.7 the seed gives the same setup, and an assignment changes only the seating', () => {
        for (const order of rotations(ids)) {
            const startingPositions = assigned(order)
            const start = () =>
                engine.startGame(game, { masterSeed: MasterSeed, startingPositions }).initialState
            const seated = start()

            expect(withoutRowId(start())).toEqual(withoutRowId(seated))
            expect(withoutSeating(seated)).toEqual(withoutSeating(unassigned))
            assert(FeudumCanonicalStateValidator.Check(seated), 'Setup must be canonical')
        }
    })

    // It plays two whole games, which take seconds each, as the scripted games in completeGame do.
    it(
        'R-1.4.7, R-X.2 assigning the order the seed draws plays the same game to the end',
        { timeout: 60_000 },
        () => {
            const drawn = assigned(unassigned.turnManager.turnOrder)
            const seated = engine.startGame(game, {
                masterSeed: MasterSeed,
                startingPositions: drawn
            })
            expect(withoutRowId(seated.initialState)).toEqual(withoutRowId(unassigned))

            const plain = walkGame(MasterSeed, count)
            const replayed = walkGame(MasterSeed, count, undefined, drawn)
            expect(replayed.steps).toHaveLength(plain.steps.length)
            expect(withoutRowId(replayed.final)).toEqual(withoutRowId(plain.final))
        }
    )

    it('R-1.4.7 every assigned setup still projects and hydrates for every seat', () => {
        for (const { order, walk } of walks) {
            const canonical = walk.initial
            assert(FeudumCanonicalStateValidator.Check(canonical), 'Setup must be canonical')
            for (const perspective of [
                { kind: 'spectator' } as const,
                ...order.map((playerId) => ({ kind: 'player', playerId }) as const)
            ]) {
                const view = projector.project(canonical, perspective, { config: game.config })
                expect(view).not.toHaveProperty('masterSeed')
                expect(view).not.toHaveProperty('vault')
                expect(view.turnManager.turnOrder).toEqual(order)
                expect(() => FeudumRuntime.hydrator.hydrateState(view)).not.toThrow()
            }
        }
    })

    it('R-1.4-H1 dummy Knight rows fill the table up to four, whoever starts', () => {
        for (const { order, walk } of walks) {
            const rows = knightRows(walk.initial).map(({ row }) => row.owner)
            expect(rows).toHaveLength(Math.max(count, MinimumKnightRows))
            expect(rows.slice(0, count).map(rowSeat)).toEqual(order)
            expect(rows.slice(count).every((owner) => 'dummy' in owner)).toBe(true)
        }
    })

    it('R-4.5.3 the apprentice space is taken only at 4 and 5 players', () => {
        const apprentices = walks.flatMap(({ walk }) =>
            walk.steps
                .flatMap(({ after }) => after)
                .flatMap((state) => Object.values(state.guilds.tracks))
                .filter((track) => track.apprentice !== undefined)
        )

        expect(apprentices.length > 0).toBe(count >= 4)
    })

    it('R-6.1, R-6.3 every rotation finishes with a result the platform accepts', () => {
        for (const { order, walk } of walks) {
            const { final } = walk
            expect(final.machineState).toBe(MachineState.EndOfGame)
            assert(FeudumCanonicalStateValidator.Check(final), 'A finished game must be canonical')
            expect(() => validateGameResult(final)).not.toThrow()
            expect(final.result).toBe(
                final.winningPlayerIds.length === 1 ? GameResult.Win : GameResult.Draw
            )

            const finalScores = FeudumRuntime.scoring.finalScores(final)
            expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
            expect(finalScores).toEqual(
                Object.fromEntries(final.players.map((row) => [row.playerId, row.score]))
            )
            const best = Math.max(...Object.values(finalScores))
            for (const winner of final.winningPlayerIds) {
                expect(finalScores[winner]).toBe(best)
            }
        }
    })

    it('R-6.3 every seat reads the same final scores from its own view', () => {
        for (const { order, walk } of walks) {
            const { final } = walk
            assert(FeudumCanonicalStateValidator.Check(final), 'A finished game must be canonical')
            const finalScores = FeudumRuntime.scoring.finalScores(final)
            for (const perspective of [
                { kind: 'spectator' } as const,
                ...order.map((playerId) => ({ kind: 'player', playerId }) as const)
            ]) {
                const view = projector.project(final, perspective, { config: game.config })
                expect(FeudumRuntime.scoring.finalScores(view)).toEqual(finalScores)
            }
        }
    })
})
