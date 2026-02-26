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
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PhaseName } from '../definition/phases.js'
import { Good } from '../definition/goods.js'
import { OperationsStateHandler } from './operations.js'

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

describe('OperationsStateHandler', () => {
    it('resets operations tracking and city demand when entering the phase', () => {
        const state = createTestState()
        const shippingDeed = state.availableDeeds.find((deed) => deed.type === CompanyType.Shipping)

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        state.companies = [
            {
                id: 'company-1',
                type: CompanyType.Shipping,
                owner: state.players[0].playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatedCompanyIds = ['legacy-company']
        state.operatingCompanyId = 'legacy-company'
        state.operatingCompanyExpansionCount = 2
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 2,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new OperationsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.Operations)
        expect(state.operatedCompanyIds).toEqual([])
        expect(state.operatingCompanyId).toBeUndefined()
        expect(state.operatingCompanyExpansionCount).toBeUndefined()
        expect(state.board.cities[0].demand).toEqual({})
    })

    it('does not reset operations tracking or city demand when already in operations phase', () => {
        const state = createTestState()
        const shippingDeed = state.availableDeeds.find((deed) => deed.type === CompanyType.Shipping)

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        state.companies = [
            {
                id: 'company-1',
                type: CompanyType.Shipping,
                owner: state.players[0].playerId,
                deeds: [shippingDeed]
            },
            {
                id: 'company-2',
                type: CompanyType.Shipping,
                owner: state.players[1].playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatedCompanyIds = ['company-1']
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 2,
            demand: {
                [Good.Rice]: 1
            }
        })

        const handler = new OperationsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.Operations)
        expect(state.operatedCompanyIds).toEqual(['company-1'])
        expect(state.board.cities[0].demand).toEqual({
            [Good.Rice]: 1
        })
    })
})
