import { describe, expect, it } from 'vitest'
import { ActionSource, createAction, type Game } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { waitingGame } from '../testing/game.js'
import { OathGameInitializer } from './initializer.js'
import { MachineState } from './states.js'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'

function rotations(ids: readonly string[]): string[][] {
    return ids.map((_, start) => [...ids.slice(start), ...ids.slice(0, start)])
}

function start(game: Game, order?: string[]): OathProjectedState {
    return engine.startGame(game, {
        masterSeed: MASTER_SEED,
        ...(order ? { startingPositions: { playerIds: order } } : {})
    }).initialState
}

/** R-1.23 — each seat keeps an adviser and places its pawn, in turn order. */
function playSetup(game: Game, initial: OathProjectedState) {
    let state = initial
    const actors: string[] = []
    while (state.machineState === MachineState.Setup) {
        const hydrated = new HydratedOathGameState(state)
        const [playerId] = state.activePlayerIds
        const hand = hydrated.getPlayerState(playerId).knownHand()
        const siteId =
            playerId === state.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1]
        const action = createAction(SetupChoice, {
            id: `setup-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            index: state.actionCount,
            playerId,
            siteId,
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        })
        state = engine.run(action, state, game).updatedState
        actors.push(playerId)
    }
    return { state, actors }
}

describe.each([2, 3, 4, 5, 6])('Oath tournaments with %i players', (count) => {
    it('R-1.7 — position zero is the Chancellor, and every seat keeps its assigned place through setup', () => {
        const game = waitingGame(count)
        expect(new OathGameInitializer().supportsStartingPositions).toBe(true)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const initial = start(game, order)
            expect(initial.turnManager.turnOrder).toEqual(order)
            expect(initial.players.map((player) => player.playerId)).toEqual(order)
            expect(initial.chancellorPlayerId).toBe(order[0])
            expect(initial.players[0]).toMatchObject({ status: PlayerStatus.Chancellor, color: IMPERIAL_COLOR })
            expect(initial.machineState).toBe(MachineState.Setup)

            const { state, actors } = playSetup(game, initial)
            expect(actors).toEqual(order)
            expect(state.turnManager.series.at(-1)?.playerId).toBe(order[0])
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it('an assignment moves no seeded draw: the deal and the colour each seat takes stay as an unassigned game deals them', () => {
        const game = waitingGame(count)
        const uninitialized = engine.generateUninitializedState(game)
        const initialize = (order?: string[]) =>
            new OathGameInitializer()
                .initializeGameState(game, structuredClone(uninitialized), order ? { playerIds: order } : undefined)
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

        const seatColors = (state: OathProjectedState) => state.players.map((player) => player.color)
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
