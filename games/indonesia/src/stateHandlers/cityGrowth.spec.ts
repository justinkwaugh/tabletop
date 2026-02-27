import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    createAction,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AreaType } from '../components/area.js'
import { ActionType } from '../definition/actions.js'
import { Era } from '../definition/eras.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { GrowCity, HydratedGrowCity } from '../actions/growCity.js'
import { CityGrowthStateHandler } from './cityGrowth.js'

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

describe('CityGrowthStateHandler', () => {
    it('queues an automatic grow action when all eligible upgrades are deterministic', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new CityGrowthStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.CityGrowth)
        expect(state.turnManager.currentTurn()).toBeUndefined()
        expect(context.getPendingActions()).toHaveLength(1)
        expect(context.getPendingActions()[0]).toMatchObject({
            type: ActionType.GrowCity,
            cityId: 'city-1'
        })
    })

    it('does not queue automatic growth when player choice is required by token shortage', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.availableCities.size2 = 1
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })
        state.board.addCity({
            id: 'city-2',
            area: 'A02',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new CityGrowthStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.CityGrowth)
        expect(state.activePlayerIds).toEqual([growthDecisionPlayerId])
        expect(state.turnManager.currentTurn()?.playerId).toBe(growthDecisionPlayerId)
        expect(context.getPendingActions()).toHaveLength(0)
    })

    it('ends city growth and clears demand after the final city growth action', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new CityGrowthStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const action = new HydratedGrowCity(
            createAction(GrowCity, {
                id: `grow-city-${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: growthDecisionPlayerId,
                type: ActionType.GrowCity,
                cityId: 'city-1'
            })
        )

        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.BiddingForTurnOrder)
        expect(state.phaseManager.currentPhase).toBeUndefined()
        expect(state.activePlayerIds).toEqual([])
        expect(state.board.cities[0].size).toBe(2)
        expect(state.board.cities[0].demand).toEqual({})
    })

    it('starts a new era when no available deeds remain after city growth', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.availableDeeds = []
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new CityGrowthStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const action = new HydratedGrowCity(
            createAction(GrowCity, {
                id: `grow-city-${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: growthDecisionPlayerId,
                type: ActionType.GrowCity,
                cityId: 'city-1'
            })
        )

        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.NewEra)
        expect(state.era).toBe(Era.B)
    })
})
