import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseOperatingCompany } from './chooseOperatingCompany.js'

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

describe('HydratedChooseOperatingCompany.canChooseSpecificCompany', () => {
    it('blocks choosing a shipping company that cannot expand', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )

        expect(shippingDeed).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        const shippingCompanyId = 'shipping-full'
        const shippingCapacity = shippingDeed.sizes[state.era] ?? 0
        state.machineState = MachineState.Operations
        state.companies = [
            {
                id: shippingCompanyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.board.areas.S01 = {
            id: 'S01',
            type: AreaType.Sea,
            ships: Array.from({ length: shippingCapacity }, () => shippingCompanyId)
        }

        expect(
            HydratedChooseOperatingCompany.canChooseSpecificCompany(
                state,
                playerId,
                shippingCompanyId
            )
        ).toBe(false)
    })

    it('blocks choosing a production company that has no city demand', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )

        expect(productionDeed).toBeDefined()
        if (!productionDeed || productionDeed.type !== CompanyType.Production) {
            return
        }

        const companyId = 'production-no-demand'
        state.machineState = MachineState.Operations
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Production,
                owner: playerId,
                deeds: [productionDeed],
                good: productionDeed.good
            }
        ]
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId,
            good: productionDeed.good
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [productionDeed.good]: 1
            }
        })

        expect(
            HydratedChooseOperatingCompany.canChooseSpecificCompany(state, playerId, companyId)
        ).toBe(false)
    })
})
