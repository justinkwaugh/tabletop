import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    createAction,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { HydratedRemoveCompanyDeed, RemoveCompanyDeed } from './removeCompanyDeed.js'

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

describe('HydratedRemoveCompanyDeed', () => {
    it('removes a deed when it cannot be started', () => {
        const state = createTestState()
        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )

        expect(productionDeed).toBeDefined()
        if (!productionDeed || productionDeed.type !== CompanyType.Production) {
            return
        }

        const blockerGood = productionDeed.good === Good.Rice ? Good.Spice : Good.Rice
        for (const area of state.board.areasForRegion(productionDeed.region)) {
            state.board.areas[area.id] = {
                id: area.id,
                type: AreaType.Cultivated,
                companyId: `blocker-${area.id}`,
                good: blockerGood
            }
        }

        state.availableDeeds = [productionDeed]

        const action = new HydratedRemoveCompanyDeed(
            createAction(RemoveCompanyDeed, {
                id: 'remove-deed-action',
                gameId: state.gameId,
                source: ActionSource.System,
                deedId: productionDeed.id
            })
        )

        action.apply(state)

        expect(state.availableDeeds).toHaveLength(0)
        expect(action.metadata?.deed.id).toBe(productionDeed.id)
    })

    it('throws when deed is still startable', () => {
        const state = createTestState()
        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )

        expect(productionDeed).toBeDefined()
        if (!productionDeed) {
            return
        }

        const action = new HydratedRemoveCompanyDeed(
            createAction(RemoveCompanyDeed, {
                id: 'remove-deed-action-invalid',
                gameId: state.gameId,
                source: ActionSource.System,
                deedId: productionDeed.id
            })
        )

        expect(() => action.apply(state)).toThrow('Invalid RemoveCompanyDeed action')
    })
})
