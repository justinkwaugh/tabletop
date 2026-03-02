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
import { HydratedPass, Pass, PassReason } from '../actions/pass.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { AreaType } from '../components/area.js'
import { HydratedProposeMerger, ProposeMerger } from '../actions/proposeMerger.js'

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

describe('MergersStateHandler', () => {
    it('skips announcers with no legal merger options', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new MergersStateHandler()

        const [firstPlayerId, secondPlayerId] = state.turnManager.turnOrder
        expect(firstPlayerId).toBeDefined()
        expect(secondPlayerId).toBeDefined()
        if (!firstPlayerId || !secondPlayerId) {
            return
        }

        state.getPlayerState(firstPlayerId).research.mergers = 1
        state.getPlayerState(secondPlayerId).research.mergers = 1
        state.getPlayerState(firstPlayerId).ownedCompanies = ['occupied-slot']

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        const companyAId = 'skipped-merger-company-a'
        const companyBId = 'skipped-merger-company-b'
        state.companies = [
            {
                id: companyAId,
                type: CompanyType.Production,
                owner: secondPlayerId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: companyBId,
                type: CompanyType.Production,
                owner: secondPlayerId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(secondPlayerId).ownedCompanies = [companyAId, companyBId]

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: companyAId,
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: companyBId,
            good: Good.Rice
        }

        expect(HydratedProposeMerger.canProposeMerger(state, firstPlayerId)).toBe(false)
        expect(HydratedProposeMerger.canProposeMerger(state, secondPlayerId)).toBe(true)

        handler.enter(context)

        expect(state.mergerAnnouncementOrder).toEqual([secondPlayerId])
        expect(state.activePlayerIds).toEqual([secondPlayerId])
    })

    it('ends the phase when a full announcement cycle has no merger announcements', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new MergersStateHandler()

        const announcerId = state.turnManager.turnOrder[0]
        expect(announcerId).toBeDefined()
        if (!announcerId) {
            return
        }

        state.getPlayerState(announcerId).research.mergers = 1
        handler.enter(context)

        expect(state.activePlayerIds).toEqual([announcerId])

        const passAction = new HydratedPass(
            createAction(Pass, {
                id: 'pass-announcement',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                reason: PassReason.DeclineMergerAnnouncement
            })
        )

        passAction.apply(state, context)
        const nextState = handler.onAction(passAction, context)

        expect(nextState).toBe(MachineState.Acquisitions)
    })

    it('resolves a merger immediately when only one bidder is eligible', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new MergersStateHandler()

        const [announcerId, otherPlayerId] = state.turnManager.turnOrder
        expect(announcerId).toBeDefined()
        expect(otherPlayerId).toBeDefined()
        if (!announcerId || !otherPlayerId) {
            return
        }

        state.getPlayerState(announcerId).research.mergers = 1
        state.getPlayerState(otherPlayerId).ownedCompanies = ['occupied-slot']

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        const companyAId = 'company-a'
        const companyBId = 'company-b'

        state.companies = [
            {
                id: companyAId,
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: companyBId,
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(announcerId).ownedCompanies = [companyAId, companyBId]

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: companyAId,
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: companyBId,
            good: Good.Rice
        }

        handler.enter(context)

        const options = HydratedProposeMerger.listProposableMergers(state, announcerId)
        const option = options.find(
            (entry) =>
                (entry.companyAId === companyAId && entry.companyBId === companyBId) ||
                (entry.companyAId === companyBId && entry.companyBId === companyAId)
        )
        expect(option).toBeDefined()
        if (!option) {
            return
        }

        const proposeAction = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-single-bidder',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                companyAId,
                companyBId,
                openingBid: option.nominalValue
            })
        )

        proposeAction.apply(state, context)
        const nextState = handler.onAction(proposeAction, context)

        expect(nextState).toBe(MachineState.Mergers)
        expect(state.activeMergerProposal).toBeUndefined()
        expect(state.activeMergerAuction).toBeUndefined()
        expect(state.companies).toHaveLength(1)
        expect(state.companies[0]?.deeds).toHaveLength(2)
        expect(state.mergedDeedIdsThisYear).toEqual(expect.arrayContaining([deedA.id, deedB.id]))
    })
})
