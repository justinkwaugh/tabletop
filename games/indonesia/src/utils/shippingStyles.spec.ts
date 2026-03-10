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
import { CompanyType } from '../definition/companyType.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { chooseMergedShippingStyle, chooseNewShippingStyle, resolveShippingStyleByCompanyId } from './shippingStyles.js'

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

function addShippingCompany(
    state: ReturnType<typeof createTestState>,
    {
        companyId,
        ownerId,
        deedIndex,
        shipStyle
    }: { companyId: string, ownerId: string, deedIndex: number, shipStyle?: 'a' | 'b' | 'c' }
): void {
    const deed = state.availableDeeds.filter((candidate) => candidate.type === CompanyType.Shipping)[deedIndex]
    expect(deed).toBeDefined()
    if (!deed || deed.type !== CompanyType.Shipping) {
        return
    }

    state.companies.push({
        id: companyId,
        type: CompanyType.Shipping,
        owner: ownerId,
        deeds: [deed],
        shipStyle
    })
    state.getPlayerState(ownerId).ownedCompanies.push(companyId)
}

describe('shipping style assignment', () => {
    it('resolves missing styles without duplicating an owner persisted styles when possible', () => {
        const state = createTestState()
        const [playerOneId, playerTwoId] = state.players.map((player) => player.playerId)

        addShippingCompany(state, {
            companyId: 'p1-shipping-a',
            ownerId: playerOneId,
            deedIndex: 0,
            shipStyle: 'c'
        })
        addShippingCompany(state, {
            companyId: 'p1-shipping-b',
            ownerId: playerOneId,
            deedIndex: 1
        })
        addShippingCompany(state, {
            companyId: 'p2-shipping-a',
            ownerId: playerTwoId,
            deedIndex: 2,
            shipStyle: 'a'
        })

        const styleByCompanyId = resolveShippingStyleByCompanyId(state)
        expect(styleByCompanyId.get('p1-shipping-a')).toBe('c')
        expect(styleByCompanyId.get('p1-shipping-b')).toBe('b')
        expect(styleByCompanyId.get('p2-shipping-a')).toBe('a')
    })

    it('prefers an unused style for a player and least globally-used style when starting a new company', () => {
        const state = createTestState()
        const [playerOneId, playerTwoId, playerThreeId] = state.players.map((player) => player.playerId)

        addShippingCompany(state, {
            companyId: 'p1-shipping-a',
            ownerId: playerOneId,
            deedIndex: 0,
            shipStyle: 'a'
        })
        addShippingCompany(state, {
            companyId: 'p2-shipping-a',
            ownerId: playerTwoId,
            deedIndex: 1,
            shipStyle: 'b'
        })
        addShippingCompany(state, {
            companyId: 'p3-shipping-a',
            ownerId: playerThreeId,
            deedIndex: 2,
            shipStyle: 'b'
        })

        expect(chooseNewShippingStyle(state, playerOneId)).toBe('c')
    })

    it('preserves the winning player existing company style during a shipping merger', () => {
        const state = createTestState()
        const [winnerId, otherPlayerId] = state.players.map((player) => player.playerId)

        addShippingCompany(state, {
            companyId: 'winner-shipping',
            ownerId: winnerId,
            deedIndex: 0,
            shipStyle: 'b'
        })
        addShippingCompany(state, {
            companyId: 'other-shipping',
            ownerId: otherPlayerId,
            deedIndex: 1,
            shipStyle: 'a'
        })

        expect(
            chooseMergedShippingStyle(state, winnerId, ['winner-shipping', 'other-shipping'])
        ).toBe('b')
    })

    it('assigns a new winner-compatible style when the winner owned neither merged shipping company', () => {
        const state = createTestState()
        const [winnerId, otherPlayerId, thirdPlayerId] = state.players.map((player) => player.playerId)

        addShippingCompany(state, {
            companyId: 'winner-existing',
            ownerId: winnerId,
            deedIndex: 0,
            shipStyle: 'a'
        })
        addShippingCompany(state, {
            companyId: 'merge-company-a',
            ownerId: otherPlayerId,
            deedIndex: 1,
            shipStyle: 'b'
        })
        addShippingCompany(state, {
            companyId: 'merge-company-b',
            ownerId: thirdPlayerId,
            deedIndex: 2,
            shipStyle: 'c'
        })

        expect(
            chooseMergedShippingStyle(state, winnerId, ['merge-company-a', 'merge-company-b'])
        ).toBe('b')
    })
})
