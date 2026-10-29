import { describe, expect, it } from 'vitest'
import { required } from '../testing/required.js'
import { GameResult, assert, validateGameResult, type Game } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { waitingGame } from '../testing/game.js'
import {
    assignedGame,
    finishedWithin,
    playSetup,
    playUntilTheEnd,
    start
} from '../testing/playthrough.js'
import { OathGameInitializer } from './initializer.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import { MachineState } from './states.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { OathGameStateValidator, type OathProjectedState } from '../model/gameState.js'
import { OathImperialColor } from './colors.js'

/** R-1.13 — the Oath changes setup: who holds a banner. The deck has one option, Random. */
const CONFIGS = Object.values(OathType).map((oathType) => ({ oathType }))

/** R-1.13 — the banner the Chancellor starts with, if the Oath gives one. */
const OATH_BANNER: Partial<Record<OathType, Banner>> = {
    [OathType.Devotion]: Banner.DarkestSecret,
    [OathType.ThePeople]: Banner.PeoplesFavor
}

function rotations(ids: readonly string[]): string[][] {
    return ids.map((_, start) => [...ids.slice(start), ...ids.slice(0, start)])
}

describe.each(CONFIGS)('Oath tournaments, $oathType', (config) => {
    describe.each([2, 3, 4, 5, 6])('with %i players', (count) => {
        it('R-1.7 — position zero is the Chancellor, and every seat keeps its assigned place through setup', () => {
            const game = waitingGame(count, config)
            expect(new OathGameInitializer().supportsStartingPositions).toBe(true)
            const unassigned = start(game)
            const banner = OATH_BANNER[config.oathType]
            for (const order of rotations(game.players.map((player) => player.id))) {
                const initial = start(game, order)
                expect(initial.turnManager.turnOrder).toEqual(order)
                expect(initial.players.map((player) => player.playerId)).toEqual(order)
                expect(initial.chancellorPlayerId).toBe(order[0])
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
            const game = waitingGame(count, config)
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
