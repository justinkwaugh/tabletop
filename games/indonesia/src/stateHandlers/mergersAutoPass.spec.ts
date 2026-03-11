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
import { MergersStateHandler } from './mergers.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { AreaType } from '../components/area.js'
import { HydratedProposeMerger, ProposeMerger } from '../actions/proposeMerger.js'
import { HydratedPlaceMergerBid, PlaceMergerBid } from '../actions/placeMergerBid.js'
import { HydratedPassMergerBid, isPassMergerBid } from '../actions/passMergerBid.js'
import { isMergeCompanies } from '../actions/mergeCompanies.js'

function createThreePlayerMergersState() {
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

    const initialized = new IndonesiaGameInitializer().initializeGameState(game, state)
    initialized.machineState = MachineState.Mergers
    return initialized
}

function createMachineContext(state: ReturnType<typeof createThreePlayerMergersState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('Mergers auto-pass sequencing', () => {
    it('does not queue a stale extra auto-pass once only one bidder remains', () => {
        const state = createThreePlayerMergersState()
        const context = createMachineContext(state)
        const handler = new MergersStateHandler()

        const [announcerId, secondBidderId, thirdBidderId] = state.turnManager.turnOrder
        expect(announcerId).toBeDefined()
        expect(secondBidderId).toBeDefined()
        expect(thirdBidderId).toBeDefined()
        if (!announcerId || !secondBidderId || !thirdBidderId) {
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
                id: 'merger-company-a',
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: 'merger-company-b',
                type: CompanyType.Production,
                owner: secondBidderId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(announcerId).ownedCompanies = ['merger-company-a']
        state.getPlayerState(secondBidderId).ownedCompanies = ['merger-company-b']
        state.getPlayerState(thirdBidderId).ownedCompanies = []

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'merger-company-a',
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'merger-company-b',
            good: Good.Rice
        }

        handler.enter(context)
        const option = HydratedProposeMerger.listProposableMergers(state, announcerId)[0]
        expect(option).toBeDefined()
        if (!option) {
            return
        }

        state.getPlayerState(announcerId).cash = 203
        state.getPlayerState(secondBidderId).cash = 214
        state.getPlayerState(thirdBidderId).cash = 102

        const proposeAction = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-three-bidder-auto-pass',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                companyAId: option.companyAId,
                companyBId: option.companyBId
            })
        )
        proposeAction.apply(state, context)
        handler.onAction(proposeAction, context)

        state.activePlayerIds = [announcerId]
        const openingBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'opening-bid-three-bidder-auto-pass',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                amount: option.nominalValue
            })
        )
        openingBidAction.apply(state, context)
        let nextState = handler.onAction(openingBidAction, context)
        state.machineState = nextState
        handler.enter(context)

        state.activePlayerIds = [secondBidderId]
        const secondBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'second-bid-three-bidder-auto-pass',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: secondBidderId,
                amount: option.nominalValue + option.bidIncrement
            })
        )
        secondBidAction.apply(state, context)
        nextState = handler.onAction(secondBidAction, context)

        const queuedThirdBidderPass = context.nextPendingAction()
        expect(queuedThirdBidderPass).toBeDefined()
        expect(isPassMergerBid(queuedThirdBidderPass)).toBe(true)
        if (!queuedThirdBidderPass || !isPassMergerBid(queuedThirdBidderPass)) {
            return
        }
        expect(queuedThirdBidderPass.playerId).toBe(thirdBidderId)

        state.machineState = nextState
        handler.enter(context)

        const thirdBidderPass = new HydratedPassMergerBid(queuedThirdBidderPass)
        thirdBidderPass.apply(state, context)
        nextState = handler.onAction(thirdBidderPass, context)
        state.machineState = nextState
        handler.enter(context)

        const nextPendingAction = context.nextPendingAction()
        expect(nextPendingAction).toBeDefined()
        expect(isMergeCompanies(nextPendingAction)).toBe(true)
    })
})
