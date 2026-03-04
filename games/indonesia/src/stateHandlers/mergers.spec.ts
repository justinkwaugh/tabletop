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
import { Era } from '../definition/eras.js'
import { AreaType } from '../components/area.js'
import { HydratedProposeMerger, ProposeMerger } from '../actions/proposeMerger.js'
import { HydratedPlaceMergerBid, PlaceMergerBid } from '../actions/placeMergerBid.js'
import { HydratedPassMergerBid, isPassMergerBid } from '../actions/passMergerBid.js'

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
                companyBId
            })
        )

        proposeAction.apply(state, context)
        const afterProposeState = handler.onAction(proposeAction, context)

        expect(afterProposeState).toBe(MachineState.Mergers)
        expect(state.activeMergerProposal).toBeDefined()
        expect(state.activeMergerAuction).toBeDefined()

        state.activePlayerIds = [announcerId]
        const openingBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'opening-bid-single-bidder',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                amount: option.nominalValue
            })
        )

        openingBidAction.apply(state, context)
        const afterOpeningBidState = handler.onAction(openingBidAction, context)

        expect(afterOpeningBidState).toBe(MachineState.Mergers)
        expect(state.activeMergerProposal).toBeUndefined()
        expect(state.activeMergerAuction).toBeUndefined()
        expect(state.companies).toHaveLength(1)
        expect(state.companies[0]?.deeds).toHaveLength(2)
        expect(state.mergedDeedIdsThisYear).toEqual(expect.arrayContaining([deedA.id, deedB.id]))
    })

    it('auto-applies a system pass when the next bidder cannot place a valid bid', () => {
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

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        const companyAId = 'auto-pass-company-a'
        const companyBId = 'auto-pass-company-b'
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
                owner: otherPlayerId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(announcerId).ownedCompanies = [companyAId]
        state.getPlayerState(otherPlayerId).ownedCompanies = [companyBId]

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
        const option = HydratedProposeMerger.listProposableMergers(state, announcerId)[0]
        expect(option).toBeDefined()
        if (!option) {
            return
        }

        // Ensure bidder can open, but next bidder cannot legally outbid.
        state.getPlayerState(otherPlayerId).cash = option.nominalValue

        const proposeAction = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-auto-pass',
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
                id: 'opening-bid-auto-pass',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                amount: option.nominalValue
            })
        )
        openingBidAction.apply(state, context)
        const stateAfterOpeningBid = handler.onAction(openingBidAction, context)

        const queuedAutoPass = context.nextPendingAction()
        expect(queuedAutoPass).toBeDefined()
        expect(isPassMergerBid(queuedAutoPass)).toBe(true)
        if (!queuedAutoPass || !isPassMergerBid(queuedAutoPass)) {
            return
        }
        expect(queuedAutoPass.playerId).toBe(otherPlayerId)
        expect(queuedAutoPass.source).toBe(ActionSource.System)

        // Mirror GameEngine sequencing: next state enters before the pending system action applies.
        state.machineState = stateAfterOpeningBid
        handler.enter(context)

        const systemPassAction = new HydratedPassMergerBid(queuedAutoPass)
        systemPassAction.apply(state, context)
        handler.onAction(systemPassAction, context)

        expect(state.activeMergerProposal).toBeUndefined()
        expect(state.activeMergerAuction).toBeUndefined()
        expect(state.companies).toHaveLength(1)
        expect(state.companies[0]?.deeds).toHaveLength(2)
    })

    it('sets merged company and cultivated areas to siap saji when rice and spice merge', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new MergersStateHandler()

        state.era = Era.B

        const [announcerId, otherPlayerId] = state.turnManager.turnOrder
        expect(announcerId).toBeDefined()
        expect(otherPlayerId).toBeDefined()
        if (!announcerId || !otherPlayerId) {
            return
        }

        state.getPlayerState(announcerId).research.mergers = 1
        state.getPlayerState(otherPlayerId).ownedCompanies = ['occupied-slot']

        const riceDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        const spiceDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Spice
        )
        expect(riceDeed).toBeDefined()
        expect(spiceDeed).toBeDefined()
        if (
            !riceDeed ||
            !spiceDeed ||
            riceDeed.type !== CompanyType.Production ||
            spiceDeed.type !== CompanyType.Production
        ) {
            return
        }

        const riceCompanyId = 'rice-company'
        const spiceCompanyId = 'spice-company'
        state.companies = [
            {
                id: riceCompanyId,
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [riceDeed],
                good: Good.Rice
            },
            {
                id: spiceCompanyId,
                type: CompanyType.Production,
                owner: announcerId,
                deeds: [spiceDeed],
                good: Good.Spice
            }
        ]
        state.getPlayerState(announcerId).ownedCompanies = [riceCompanyId, spiceCompanyId]

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: riceCompanyId,
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: spiceCompanyId,
            good: Good.Spice
        }

        handler.enter(context)

        const option = HydratedProposeMerger.listProposableMergers(state, announcerId).find(
            (entry) =>
                (entry.companyAId === riceCompanyId && entry.companyBId === spiceCompanyId) ||
                (entry.companyAId === spiceCompanyId && entry.companyBId === riceCompanyId)
        )
        expect(option?.isSiapSaji).toBe(true)
        if (!option) {
            return
        }

        const proposeAction = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-siap-saji-merger',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                companyAId: riceCompanyId,
                companyBId: spiceCompanyId
            })
        )
        proposeAction.apply(state, context)
        handler.onAction(proposeAction, context)

        state.activePlayerIds = [announcerId]
        const openingBidAction = new HydratedPlaceMergerBid(
            createAction(PlaceMergerBid, {
                id: 'opening-bid-siap-saji',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: announcerId,
                amount: option.nominalValue
            })
        )
        openingBidAction.apply(state, context)
        handler.onAction(openingBidAction, context)

        expect(state.companies).toHaveLength(1)
        const mergedCompany = state.companies[0]
        expect(mergedCompany?.type).toBe(CompanyType.Production)
        if (!mergedCompany || mergedCompany.type !== CompanyType.Production) {
            return
        }
        expect(mergedCompany.good).toBe(Good.SiapSaji)
        expect(state.pendingSiapSajiReduction?.companyId).toBe(mergedCompany.id)

        const cultivatedAreas = Object.values(state.board.areas).filter(
            (area): area is Extract<(typeof state.board.areas)[string], { type: AreaType.Cultivated }> =>
                area.type === AreaType.Cultivated && area.companyId === mergedCompany.id
        )
        expect(cultivatedAreas.length).toBe(2)
        for (const area of cultivatedAreas) {
            expect(area.good).toBe(Good.SiapSaji)
        }
    })
})
