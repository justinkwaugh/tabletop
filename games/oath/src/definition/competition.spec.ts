import { describe, expect, it } from 'vitest'
import { required } from '../testing/required.js'
import { GameResult, assert, validateGameResult, type Game } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { waitingGame } from '../testing/game.js'
import {
    assignedGame,
    finishedWithin,
    playPassiveMove,
    playSetup,
    playUntilTheEnd,
    start,
    tournamentGame
} from '../testing/playthrough.js'
import { OathGameInitializer } from './initializer.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import { MachineState } from './states.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { OathGameStateValidator, type OathProjectedState } from '../model/gameState.js'
import { OathImperialColor } from './colors.js'

/** The master seed numbered `n`, for setups drawn across seeds. */
function masterSeed(n: number): string {
    return n.toString(16).padStart(32, '0')
}

/** Enough seeds to draw each of the four Oaths at every player count. */
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1)

/**
 * R-1.13 — a new game has no options, so its config is empty, and a tournament game's Oath is
 * drawn at random; a stored or provisioned config may still name its Oath. The Oath changes setup:
 * who holds a banner.
 */
const CONFIGS: { oathType?: OathType }[] = [
    {},
    ...Object.values(OathType).map((oathType) => ({ oathType }))
]
const CONFIG_CASES = CONFIGS.map((config) => [config.oathType ?? 'no options', config] as const)

/** R-1.13 — the banner the Chancellor starts with, if the Oath gives one. */
const OATH_BANNER: Partial<Record<OathType, Banner>> = {
    [OathType.Devotion]: Banner.DarkestSecret,
    [OathType.ThePeople]: Banner.PeoplesFavor
}

function rotations(ids: readonly string[]): string[][] {
    return ids.map((_, start) => [...ids.slice(start), ...ids.slice(0, start)])
}

describe.each(CONFIG_CASES)('Oath tournaments, %s', (_name, config) => {
    describe.each([2, 3, 4, 5, 6])('with %i players', (count) => {
        it('R-1.7 — position zero is the Chancellor, and every seat keeps its assigned place through setup', () => {
            const game = tournamentGame(count, config)
            expect(new OathGameInitializer().supportsStartingPositions).toBe(true)
            const unassigned = start(game)
            if (config.oathType) expect(unassigned.oathType).toBe(config.oathType)
            const banner = OATH_BANNER[unassigned.oathType]
            for (const order of rotations(game.players.map((player) => player.id))) {
                const initial = start(game, order)
                expect(initial.turnManager.turnOrder).toEqual(order)
                expect(initial.players.map((player) => player.playerId)).toEqual(order)
                expect(initial.chancellorPlayerId).toBe(order[0])
                expect(initial.oathType).toBe(unassigned.oathType)
                expect(initial.players[0]).toMatchObject({
                    status: PlayerStatus.Chancellor,
                    color: OathImperialColor
                })
                expect(initial.oathkeeperPlayerId).toBe(order[0])
                if (banner) expect(initial.banners[banner].holderPlayerId).toBe(order[0])
                expect(initial.machineState).toBe(MachineState.Setup)
                expect(initial.vault).toEqual(unassigned.vault)
                expect(initial.map).toEqual(unassigned.map)
                expect(initial.siteCards).toEqual(unassigned.siteCards)

                const { state, actors } = playSetup(game, initial)
                expect(actors).toEqual(order)
                expect(state.turnManager.series.at(-1)?.playerId).toBe(order[0])
                expect(state.activePlayerIds).toEqual([order[0]])
            }
        })

        it('an assignment moves no seeded draw: the deal and the colour each seat takes stay as an unassigned game deals them', () => {
            const game = tournamentGame(count, config)
            const uninitialized = engine.generateUninitializedState(game)
            const initialize = (order?: string[]) =>
                new OathGameInitializer()
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        order ? { playerIds: order } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

            const seatColors = (state: OathProjectedState) =>
                state.players.map((player) => player.color)
            for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                const assigned = initialize(order)
                expect(initialize(order)).toEqual(assigned)
                expect(seatColors(assigned)).toEqual(seatColors(normal))
                expect(assigned.vault).toEqual(normal.vault)
                expect(assigned.map).toEqual(normal.map)
                expect(assigned.siteCards).toEqual(normal.siteCards)
            }
        })
    })
})

function expectOneScoredWinner(game: Game, finished: OathProjectedState, winnerId: string) {
    assert(OathGameStateValidator.Check(finished), 'A finished game is canonical')
    expect(finished.machineState).toBe(MachineState.EndOfGame)
    expect(finished.result).toBe(GameResult.Win)
    expect(finished.winningPlayerIds).toEqual([winnerId])
    // No Chronicle: the result comes at the win, and a tournament game is never continued.
    expect(finished.canContinue).toBeUndefined()
    expect(Object.keys(finished)).not.toContain('chronicle')
    expect(Object.keys(finished)).not.toContain('chronicleRecord')
    expect(() => validateGameResult(finished)).not.toThrow()

    const scoring = required(OathRuntime.scoring, 'Oath declares its final scores')
    const finalScores = scoring.finalScores(finished)
    expect(finalScores).toEqual(
        Object.fromEntries(
            game.players.map((player) => [player.id, player.id === winnerId ? 1 : 0])
        )
    )
    const spectatorView = OathVisibility.state.project(
        finished,
        { kind: 'spectator' },
        { config: game.config }
    )
    expect(scoring.finalScores(spectatorView)).toEqual(finalScores)
}

describe('Oath tournament results', () => {
    it('R-3.1 — a Usurper Wake victory passes validateGameResult and scores its one winner', () => {
        const { game, order, state } = assignedGame(3, { oathType: OathType.ThePeople })
        // The People's Favor passes to seat one after setup, as a won Campaign would hand it over.
        state.banners[Banner.PeoplesFavor].holderPlayerId = order[1]

        const finished = playUntilTheEnd(game, state)
        expect(finished.round).toBe(2)
        expectOneScoredWinner(game, finished, order[1])
    })

    it('R-3.3 — a Stable Regime victory by the Chancellor’s end die passes validateGameResult and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(3, (round) => round < 8)
        expectOneScoredWinner(game, finished, order[0])
    })

    it('R-3.4 — a War Exhaustion victory at the automatic Rest passes validateGameResult and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(3, (round) => round === 8)
        expectOneScoredWinner(game, finished, order[0])
    })
})

describe.each([2, 3, 4, 5, 6])('Oath tournament results with %i players', (count) => {
    it('a game with no options records its result at the win, with no Chronicle, and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(count, () => true)
        expect(game.config).toEqual({})
        expectOneScoredWinner(game, finished, order[0])
    })

    it('its Oath is drawn from all four across seeds; an ordinary game’s is Supremacy on every one', () => {
        const drawn = new Set<OathType>()
        for (const n of SEEDS) {
            const tournament = start(tournamentGame(count), undefined, masterSeed(n))
            expect(tournament.tournamentGame).toBe(true)
            drawn.add(tournament.oathType)
            const ordinary = start(waitingGame(count), undefined, masterSeed(n))
            expect(ordinary.oathType).toBe(OathType.Supremacy)
            expect(Object.keys(ordinary)).not.toContain('tournamentGame')
        }
        expect([...drawn].sort()).toEqual(Object.values(OathType).sort())
    })

    it.each(Object.values(OathType))(
        'drawn as %s, it sets up under that Oath and plays its first round',
        (oathType) => {
            const game = tournamentGame(count)
            const order = game.players.map((player) => player.id)
            const n = SEEDS.find(
                (seed) => start(game, order, masterSeed(seed)).oathType === oathType
            )
            assert(n !== undefined, `no seed up to ${SEEDS.length} draws ${oathType}`)
            const initial = start(game, order, masterSeed(n))
            // R-1.13, R-1.14 — the Chancellor holds the Oath's banner, if it gives one, and the title.
            const banner = OATH_BANNER[oathType]
            if (banner) expect(initial.banners[banner].holderPlayerId).toBe(order[0])
            for (const other of Object.values(Banner).filter((b) => b !== banner)) {
                expect(initial.banners[other].holderPlayerId).toBeUndefined()
            }
            expect(initial.oathkeeperPlayerId).toBe(order[0])

            let state = playSetup(game, initial).state
            const turns: string[] = []
            while (state.round === 1) {
                if (state.machineState === MachineState.ActPhase) {
                    turns.push(state.activePlayerIds[0])
                }
                state = playPassiveMove(game, state)
            }
            expect(turns).toEqual(order)
            expect(state.round).toBe(2)
            expect(state.oathType).toBe(oathType)
            // R-1.7 — the second round opens with the Chancellor's turn.
            expect(state.activePlayerIds).toEqual([order[0]])
            expect(state.winningPlayerIds).toEqual([])
        }
    )
})
