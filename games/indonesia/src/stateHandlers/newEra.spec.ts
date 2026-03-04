import {
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
import { Era } from '../definition/eras.js'
import { PhaseName } from '../definition/phases.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { isPlaceCompanyDeeds } from '../actions/placeCompanyDeeds.js'
import { NewEraStateHandler } from './newEra.js'

function createTestState() {
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
        }
    ]

    const game: Game = {
        id: 'game-1',
        typeId: 'indonesia',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Indonesia Test',
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

    return new IndonesiaGameInitializer().initializeGameState(game, state)
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('NewEraStateHandler', () => {
    it('queues place-company-deeds system action when entering era B', () => {
        const state = createTestState()
        state.era = Era.B

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const pendingPlaceCompanyDeedsActions = context
            .getPendingActions()
            .filter((pendingAction) => isPlaceCompanyDeeds(pendingAction))

        expect(pendingPlaceCompanyDeedsActions).toHaveLength(1)
    })

    it('does not settle last-earnings stack when entering a new era', () => {
        const state = createTestState()
        state.era = Era.B
        const playerId = state.turnManager.turnOrder[0]
        expect(playerId).toBeDefined()
        if (!playerId) {
            return
        }

        state.operationsEarningsByPlayerId = {
            [playerId]: 23
        }
        const cashBefore = state.getPlayerState(playerId).cash

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.getPlayerState(playerId).cash).toBe(cashBefore)
        expect(state.operationsEarningsByPlayerId).toEqual({
            [playerId]: 23
        })
    })

    it('does not queue place-company-deeds in era A', () => {
        const state = createTestState()
        state.era = Era.A

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const pendingPlaceCompanyDeedsActions = context
            .getPendingActions()
            .filter((pendingAction) => isPlaceCompanyDeeds(pendingAction))

        expect(pendingPlaceCompanyDeedsActions).toHaveLength(0)
    })

    it('does not queue place-company-deeds when NewEra phase is already active', () => {
        const state = createTestState()
        state.era = Era.B
        state.phaseManager.startPhase(PhaseName.NewEra, state.actionCount)
        const nextPlayerId = state.turnManager.turnOrder[0]
        expect(nextPlayerId).toBeDefined()
        if (!nextPlayerId) {
            return
        }
        state.placingCities = [nextPlayerId]

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const pendingPlaceCompanyDeedsActions = context
            .getPendingActions()
            .filter((pendingAction) => isPlaceCompanyDeeds(pendingAction))

        expect(pendingPlaceCompanyDeedsActions).toHaveLength(0)
    })

    it('queues place-company-deeds as a playerless system action when turn order changed', () => {
        const state = createTestState()
        state.era = Era.B
        state.turnManager.turnOrder = [...state.turnManager.turnOrder].reverse()

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const activePlayerId = state.activePlayerIds[0]
        const pendingPlaceCompanyDeedsAction = context
            .getPendingActions()
            .find((pendingAction) => isPlaceCompanyDeeds(pendingAction))

        expect(activePlayerId).toBe(state.turnManager.turnOrder[0])
        expect(pendingPlaceCompanyDeedsAction?.playerId).toBeUndefined()
    })

    it('selects the second era card on a player second placement in a two-player new era', () => {
        const state = createTestState()
        const [firstPlayerId, secondPlayerId] = state.turnManager.turnOrder
        expect(firstPlayerId).toBeDefined()
        expect(secondPlayerId).toBeDefined()
        if (!firstPlayerId || !secondPlayerId) {
            return
        }

        state.era = Era.B
        state.phaseManager.startPhase(PhaseName.NewEra, state.actionCount)
        state.placingCities = [firstPlayerId, secondPlayerId]
        state.currentCityCard = state.getPlayerState(secondPlayerId).cityCards[Era.B][0]

        const handler = new NewEraStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const expectedSecondCard = state.getPlayerState(firstPlayerId).cityCards[Era.B][1]
        expect(expectedSecondCard).toBeDefined()
        expect(state.currentCityCard?.id).toBe(expectedSecondCard?.id)
    })
})
