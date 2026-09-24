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
import { Deeds } from '../components/deed.js'
import { Era } from '../definition/eras.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import {
    HydratedPlaceCompanyDeeds,
    PlaceCompanyDeeds
} from './placeCompanyDeeds.js'

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

describe('HydratedPlaceCompanyDeeds', () => {
    it('replaces available deeds with current-era deeds', () => {
        const state = createTestState()
        const carriedDeed = state.availableDeeds[0]
        state.era = Era.B
        state.availableDeeds = carriedDeed ? [carriedDeed] : []

        const action = new HydratedPlaceCompanyDeeds(
            createAction(PlaceCompanyDeeds, {
                id: 'place-company-deeds-b',
                gameId: state.gameId,
                source: ActionSource.System
            })
        )

        action.apply(state)

        const expectedEraBIds = Deeds.filter((deed) => deed.era === Era.B).map((deed) => deed.id)
        const availableIds = state.availableDeeds.map((deed) => deed.id)

        expect(availableIds).toHaveLength(expectedEraBIds.length)
        for (const deedId of expectedEraBIds) {
            expect(availableIds).toContain(deedId)
        }
        if (carriedDeed) {
            expect(availableIds).not.toContain(carriedDeed.id)
        }
    })

    it('is not allowed in era A', () => {
        const state = createTestState()

        expect(HydratedPlaceCompanyDeeds.canPlaceCompanyDeeds(state)).toBe(false)
    })

    it('is not allowed when current-era deeds are already available', () => {
        const state = createTestState()
        state.era = Era.B
        state.availableDeeds = structuredClone(Deeds.filter((deed) => deed.era === Era.B))

        expect(HydratedPlaceCompanyDeeds.canPlaceCompanyDeeds(state)).toBe(false)
    })

    it('is allowed when out-of-era deeds remain available', () => {
        const state = createTestState()
        state.era = Era.B
        state.availableDeeds = structuredClone(Deeds.filter((deed) => deed.era === Era.A))

        expect(HydratedPlaceCompanyDeeds.canPlaceCompanyDeeds(state)).toBe(true)
    })
})
