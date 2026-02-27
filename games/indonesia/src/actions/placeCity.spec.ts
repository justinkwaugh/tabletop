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
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { isRemoveCompanyDeed } from './removeCompanyDeed.js'
import { HydratedStartCompany } from './startCompany.js'
import { HydratedPlaceCity, PlaceCity } from './placeCity.js'

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

describe('HydratedPlaceCity', () => {
    it('queues remove-company-deed for available deeds that become unstartable', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        state.machineState = MachineState.NewEra
        state.activePlayerIds = [playerId]

        const playerState = state.getPlayerState(playerId)
        const selectedDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )
        expect(selectedDeed).toBeDefined()
        if (!selectedDeed || selectedDeed.type !== CompanyType.Production) {
            return
        }

        state.currentCityCard = {
            ...playerState.cityCards[state.era][0],
            regions: [selectedDeed.region]
        }

        const selectedAreaId = Array.from(HydratedPlaceCity.validAreaIds(state, playerId))[0]

        expect(selectedAreaId).toBeDefined()
        expect(selectedDeed).toBeDefined()
        if (!selectedAreaId || !selectedDeed) {
            return
        }

        const blockerGood = selectedDeed.good === Good.Rice ? Good.Spice : Good.Rice
        for (const area of state.board.areasForRegion(selectedDeed.region)) {
            if (area.id === selectedAreaId) {
                continue
            }
            state.board.areas[area.id] = {
                id: area.id,
                type: AreaType.Cultivated,
                companyId: `blocker-${area.id}`,
                good: blockerGood
            }
        }

        const duplicateDeed = {
            ...selectedDeed,
            id: `${selectedDeed.id}-duplicate`
        }
        state.availableDeeds = [selectedDeed, duplicateDeed]

        expect(HydratedStartCompany.canDeedBeStarted(state, selectedDeed.id)).toBe(true)
        expect(HydratedStartCompany.canDeedBeStarted(state, duplicateDeed.id)).toBe(true)

        const action = new HydratedPlaceCity(
            createAction(PlaceCity, {
                id: 'place-city-action',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                areaId: selectedAreaId
            })
        )
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })

        action.apply(state, context)

        const pendingRemovals = context
            .getPendingActions()
            .filter((pendingAction) => isRemoveCompanyDeed(pendingAction))

        expect(pendingRemovals).toHaveLength(2)
        expect(pendingRemovals.map((pendingAction) => pendingAction.deedId).sort()).toEqual(
            [selectedDeed.id, duplicateDeed.id].sort()
        )
    })
})
