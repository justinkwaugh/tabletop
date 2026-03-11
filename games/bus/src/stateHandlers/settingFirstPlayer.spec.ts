import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HydratedSetFirstPlayer } from '../actions/setFirstPlayer.js'
import { BuildingSites } from '../utils/busGraph.js'
import { ActionType } from '../definition/actions.js'
import { BusGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import type { HydratedBusGameState } from '../model/gameState.js'
import { SettingFirstPlayerStateHandler } from './settingFirstPlayer.js'

function createTestState(): HydratedBusGameState {
    const players: Player[] = [
        {
            id: 'p1',
            isHuman: true,
            userId: 'u1',
            name: 'Player 1',
            status: PlayerStatus.Joined
        },
        {
            id: 'p2',
            isHuman: true,
            userId: 'u2',
            name: 'Player 2',
            status: PlayerStatus.Joined
        },
        {
            id: 'p3',
            isHuman: true,
            userId: 'u3',
            name: 'Player 3',
            status: PlayerStatus.Joined
        }
    ]

    const game: Game = {
        id: 'game-1',
        typeId: 'bus',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Bus Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const initialized = new BusGameInitializer().initializeGameState(game, state)
    initialized.machineState = MachineState.SettingFirstPlayer
    initialized.turnManager.turnOrder = ['p1', 'p2', 'p3']
    return initialized
}

function createMachineContext(state: HydratedBusGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function createSetFirstPlayerAction(state: HydratedBusGameState, playerId: string) {
    return new HydratedSetFirstPlayer({
        id: 'action-set-first-player',
        gameId: state.gameId,
        source: ActionSource.System,
        playerId,
        type: ActionType.SetFirstPlayer
    })
}

describe('SettingFirstPlayerStateHandler', () => {
    it('rotates to the next player in turn order who still has action tokens when nobody took starting player', () => {
        const state = createTestState()
        const handler = new SettingFirstPlayerStateHandler()
        const context = createMachineContext(state)

        state.getPlayerState('p1').actions = 0
        state.getPlayerState('p2').actions = 0
        state.getPlayerState('p3').actions = 2

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p3'])
        expect(context.getPendingActions()).toHaveLength(1)
        expect(context.getPendingActions()[0]).toMatchObject({
            source: ActionSource.System,
            type: ActionType.SetFirstPlayer,
            playerId: 'p3'
        })
    })

    it('keeps the current first player when nobody valid remains to receive starting player', () => {
        const state = createTestState()
        const handler = new SettingFirstPlayerStateHandler()
        const context = createMachineContext(state)

        state.getPlayerState('p1').actions = 0
        state.getPlayerState('p2').actions = 0
        state.getPlayerState('p3').actions = 0

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p1'])
        expect(context.getPendingActions()).toHaveLength(1)
        expect(context.getPendingActions()[0]).toMatchObject({
            source: ActionSource.System,
            type: ActionType.SetFirstPlayer,
            playerId: 'p1'
        })
    })

    it('still honors the explicit starting-player action when one was taken', () => {
        const state = createTestState()
        const handler = new SettingFirstPlayerStateHandler()
        const context = createMachineContext(state)

        state.startingPlayerAction = 'p2'
        state.getPlayerState('p2').actions = 0

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p2'])
        expect(context.getPendingActions()).toHaveLength(1)
        expect(context.getPendingActions()[0]).toMatchObject({
            source: ActionSource.System,
            type: ActionType.SetFirstPlayer,
            playerId: 'p2'
        })
    })

    it('transitions to end of game instead of choosing actions when no players have actions left', () => {
        const state = createTestState()
        const handler = new SettingFirstPlayerStateHandler()
        const context = createMachineContext(state)

        state.getPlayerState('p1').actions = 0
        state.getPlayerState('p2').actions = 0
        state.getPlayerState('p3').actions = 0
        state.board.openSitesForPhase = () => [BuildingSites.B01]
        handler.enter(context)

        const nextState = handler.onAction(createSetFirstPlayerAction(state, 'p1'), context)

        expect(nextState).toBe(MachineState.EndOfGame)
    })
})
