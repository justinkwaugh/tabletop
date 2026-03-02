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
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { AreaType } from '../components/area.js'
import { HydratedProposeMerger, ProposeMerger } from './proposeMerger.js'
import { HydratedPlaceMergerBid, PlaceMergerBid } from './placeMergerBid.js'

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

    const initialized = new IndonesiaGameInitializer().initializeGameState(game, state)
    initialized.machineState = MachineState.Mergers
    return initialized
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('HydratedPlaceMergerBid', () => {
    it('requires bids to be strictly greater than the current high bid and aligned to increment', () => {
        const state = createTestState()
        const context = createMachineContext(state)

        const [announcerId, bidderId] = state.turnManager.turnOrder
        expect(announcerId).toBeDefined()
        expect(bidderId).toBeDefined()
        if (!announcerId || !bidderId) {
            return
        }

        state.getPlayerState(announcerId).research.mergers = 1

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        state.companies = [
            {
                id: 'company-a',
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: 'company-b',
                type: CompanyType.Production,
                owner: bidderId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(announcerId).ownedCompanies = ['company-a']
        state.getPlayerState(bidderId).ownedCompanies = ['company-b']

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'company-a',
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'company-b',
            good: Good.Rice
        }

        state.mergerAnnouncementOrder = state.turnManager.turnOrder
        state.mergerNextAnnouncerIndex = 0
        state.activePlayerIds = [announcerId]
        const option = HydratedProposeMerger.listProposableMergers(state, announcerId)[0]
        expect(option).toBeDefined()
        if (!option) {
            return
        }

        const proposeAction = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-for-bid-validation',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                companyAId: option.companyAId,
                companyBId: option.companyBId,
                openingBid: option.nominalValue
            })
        )
        proposeAction.apply(state, context)

        state.activePlayerIds = [bidderId]

        const equalBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'equal-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: bidderId,
                amount: option.nominalValue
            })
        )
        expect(equalBidAction.isValidPlaceMergerBid(state)).toBe(false)

        const misalignedBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'misaligned-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: bidderId,
                amount: option.nominalValue + 1
            })
        )
        expect(misalignedBidAction.isValidPlaceMergerBid(state)).toBe(false)

        const validBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'valid-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: bidderId,
                amount: option.nominalValue + option.bidIncrement
            })
        )
        expect(validBidAction.isValidPlaceMergerBid(state)).toBe(true)
    })
})
