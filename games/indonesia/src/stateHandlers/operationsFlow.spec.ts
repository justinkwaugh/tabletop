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
import { CompanyType } from '../definition/companyType.js'
import { Era } from '../definition/eras.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { isRemoveCompanyDeed } from '../actions/removeCompanyDeed.js'
import { finishOperatingCompany, resolvePostOperationsState } from './operationsFlow.js'

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

describe('finishOperatingCompany', () => {
    it('queues unstartable deed removals and advances era using startable deed set', () => {
        const state = createTestState()
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })
        state.era = Era.B
        state.availableDeeds = [
            {
                id: 'unst-startable',
                type: CompanyType.Production,
                era: Era.B,
                region: 'R99',
                good: Good.Rubber
            },
            {
                id: 'still-startable',
                type: CompanyType.Production,
                era: Era.B,
                region: 'R16',
                good: Good.Spice
            }
        ]

        const nextState = resolvePostOperationsState(state, context)

        expect(nextState).toBe(MachineState.NewEra)
        expect(state.era).toBe(Era.C)
        expect(state.availableDeeds.map((deed) => deed.id)).toEqual([
            'unst-startable',
            'still-startable'
        ])
        expect(
            context.getPendingActions().some(
                (pendingAction) =>
                    isRemoveCompanyDeed(pendingAction) &&
                    pendingAction.deedId === 'unst-startable'
            )
        ).toBe(true)
    })

    it('transitions to end-of-game when era C would start a new era', () => {
        const state = createTestState()
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })
        const playerId = state.players[0].playerId
        state.getPlayerState(playerId).cash = 40
        state.operationsEarningsByPlayerId = {
            [playerId]: 12
        }
        state.era = Era.C
        state.availableDeeds = []

        const nextState = resolvePostOperationsState(state, context)

        expect(nextState).toBe(MachineState.EndOfGame)
        expect(state.era).toBe(Era.C)
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.NewEra)
        expect(state.getPlayerState(playerId).cash).toBe(64)
        expect(state.operationsEarningsByPlayerId).toBeUndefined()
        expect(context.getPendingActions().some((pendingAction) => isRemoveCompanyDeed(pendingAction))).toBe(
            false
        )
    })

    it('settles operations earnings into cash when operations phase ends', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        const companyId = 'company-1'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]
        state.machineState = MachineState.ShippingOperations
        state.beginCompanyOperation(companyId)
        state.addOperationsIncomeForCompany(companyId, 19)
        state.operationsDeliveredCultivatedAreaIdsByCompanyId = {
            [companyId]: ['A01']
        }

        const cashBefore = state.getPlayerState(playerId).cash
        const nextState = finishOperatingCompany(state)

        expect(nextState).toBe(MachineState.BiddingForTurnOrder)
        expect(state.getPlayerState(playerId).cash).toBe(cashBefore + 19)
        expect(state.operationsEarningsByPlayerId).toBeUndefined()
        expect(state.operationsIncomeByCompanyId).toBeUndefined()
        expect(state.operationsDeliveredCultivatedAreaIdsByCompanyId).toBeUndefined()
    })

    it('settles negative operations earnings into cash when operations phase ends', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        const companyId = 'company-1'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]
        state.machineState = MachineState.ShippingOperations
        state.beginCompanyOperation(companyId)
        state.addOperationsIncomeForCompany(companyId, -11)

        const cashBefore = state.getPlayerState(playerId).cash
        const nextState = finishOperatingCompany(state)

        expect(nextState).toBe(MachineState.BiddingForTurnOrder)
        expect(state.getPlayerState(playerId).cash).toBe(cashBefore - 11)
        expect(state.operationsEarningsByPlayerId).toBeUndefined()
        expect(state.operationsIncomeByCompanyId).toBeUndefined()
    })

    it('clears delivered city demand immediately when skipping city growth', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        const companyId = 'company-1'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })
        state.availableCities.size2 = 0
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]
        state.machineState = MachineState.ShippingOperations
        state.beginCompanyOperation(companyId)

        const nextState = finishOperatingCompany(state)

        expect(nextState).toBe(MachineState.BiddingForTurnOrder)
        expect(state.board.cities[0]?.demand).toEqual({})
    })
})
