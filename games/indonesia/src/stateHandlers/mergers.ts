import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedProposeMerger, isProposeMerger } from '../actions/proposeMerger.js'
import { HydratedPass, isPass, PassReason } from '../actions/pass.js'
import { HydratedPlaceMergerBid, isPlaceMergerBid } from '../actions/placeMergerBid.js'
import {
    HydratedPassMergerBid,
    isPassMergerBid,
    PassMergerBid
} from '../actions/passMergerBid.js'
import {
    HydratedRemoveSiapSajiArea,
    isRemoveSiapSajiArea
} from '../actions/removeSiapSajiArea.js'
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaNeighborDirection } from '../utils/indonesiaNodes.js'
import {
    activeAuctionParticipantCount,
    canAnyPlayerAnnounceMerger,
    highestBidderId,
    mergerAnnouncementOrder,
    validSiapSajiRemovalAreaIds
} from '../operations/mergers.js'
import { AreaType, isCultivatedArea, isSeaArea } from '../components/area.js'
import { resolvePostMergersState } from './operationsFlow.js'

type MergersAction =
    | HydratedProposeMerger
    | HydratedPass
    | HydratedPlaceMergerBid
    | HydratedPassMergerBid
    | HydratedRemoveSiapSajiArea
    | HydratedRemoveCompanyDeed

export class MergersStateHandler implements MachineStateHandler<MergersAction, HydratedIndonesiaGameState> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is MergersAction {
        return (
            isProposeMerger(action) ||
            isPass(action) ||
            isPlaceMergerBid(action) ||
            isPassMergerBid(action) ||
            isRemoveSiapSajiArea(action) ||
            isRemoveCompanyDeed(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const state = context.gameState
        const validActions: ActionType[] = []

        if (state.activePlayerIds[0] !== playerId) {
            return validActions
        }

        if (state.pendingSiapSajiReduction) {
            if (HydratedRemoveSiapSajiArea.canRemoveSiapSajiArea(state, playerId)) {
                validActions.push(ActionType.RemoveSiapSajiArea)
            }
            return validActions
        }

        if (state.activeMergerProposal && state.activeMergerAuction) {
            if (HydratedPlaceMergerBid.canPlaceMergerBid(state, playerId)) {
                validActions.push(ActionType.PlaceMergerBid)
            }
            if (HydratedPassMergerBid.canPassMergerBid(state, playerId)) {
                validActions.push(ActionType.PassMergerBid)
            }
            return validActions
        }

        if (HydratedProposeMerger.canProposeMerger(state, playerId)) {
            validActions.push(ActionType.ProposeMerger)
        }

        if (HydratedPass.canPass(state, playerId, PassReason.DeclineMergerAnnouncement)) {
            validActions.push(ActionType.Pass)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const state = context.gameState
        const phaseManager = state.phaseManager

        if (phaseManager.currentPhase?.name !== PhaseName.Mergers) {
            phaseManager.startPhase(PhaseName.Mergers, state.actionCount)
            state.resetMergersForYear()
            state.mergerAnnouncementOrder = mergerAnnouncementOrder(state)
            state.mergerNextAnnouncerIndex = 0
            state.mergerVisitedAnnouncersInCycle = 0
            state.mergerAnnouncementsInCycle = 0
        }

        if (
            state.pendingSiapSajiReduction &&
            state.pendingSiapSajiReduction.removalsRemaining > 0
        ) {
            const validAreaIds = validSiapSajiRemovalAreaIds(
                state,
                state.pendingSiapSajiReduction.companyId
            )
            assert(
                validAreaIds.length > 0,
                'Siap saji reduction must always have at least one removable border area'
            )
        }

        if (state.pendingSiapSajiReduction) {
            state.activePlayerIds = [state.pendingSiapSajiReduction.winnerId]
            return
        }

        if (state.activeMergerProposal && state.activeMergerAuction) {
            const currentBidder = state.mergerCurrentBidderId
            if (currentBidder) {
                state.activePlayerIds = [currentBidder]
                return
            }
        }

        this.refreshAnnouncementOrder(state)
        const order = state.mergerAnnouncementOrder ?? []
        if (order.length === 0) {
            state.activePlayerIds = []
            return
        }

        const nextAnnouncerIndex = state.mergerNextAnnouncerIndex ?? 0
        const nextAnnouncerId = order[nextAnnouncerIndex]
        assertExists(nextAnnouncerId, 'Expected a merger announcer id while entering Mergers state')
        state.activePlayerIds = [nextAnnouncerId]
    }

    onAction(action: MergersAction, context: MachineContext<HydratedIndonesiaGameState>): MachineState {
        const state = context.gameState
        switch (true) {
            case isProposeMerger(action): {
                this.advanceAnnouncementCycle(state, true)
                this.maybeFinalizeMergerAuction(state)
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isPass(action): {
                if (action.reason !== PassReason.DeclineMergerAnnouncement) {
                    return MachineState.Mergers
                }

                const endedWithoutAnnouncements = this.advanceAnnouncementCycle(state, false)
                if (endedWithoutAnnouncements) {
                    state.phaseManager.endPhase(state.actionCount)
                    state.activePlayerIds = []
                    state.clearActiveMergerState()
                    return resolvePostMergersState(state)
                }

                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isPlaceMergerBid(action): {
                this.maybeFinalizeMergerAuction(state)
                this.queueAutoPassForIneligibleCurrentBidder(state, context)
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isPassMergerBid(action): {
                this.maybeFinalizeMergerAuction(state)
                this.queueAutoPassForIneligibleCurrentBidder(state, context)
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isRemoveSiapSajiArea(action): {
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isRemoveCompanyDeed(action): {
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private advanceAnnouncementCycle(
        state: HydratedIndonesiaGameState,
        announcedMerger: boolean
    ): boolean {
        const order = state.mergerAnnouncementOrder ?? []
        assert(order.length > 0, 'Merger announcement order should contain at least one player')

        const visited = (state.mergerVisitedAnnouncersInCycle ?? 0) + 1
        const announcements = (state.mergerAnnouncementsInCycle ?? 0) + (announcedMerger ? 1 : 0)
        const nextAnnouncerIndex = ((state.mergerNextAnnouncerIndex ?? 0) + 1) % order.length

        state.mergerNextAnnouncerIndex = nextAnnouncerIndex
        state.mergerVisitedAnnouncersInCycle = visited
        state.mergerAnnouncementsInCycle = announcements

        if (visited < order.length) {
            return false
        }

        if (announcements <= 0) {
            return true
        }

        state.mergerVisitedAnnouncersInCycle = 0
        state.mergerAnnouncementsInCycle = 0
        return false
    }

    private refreshAnnouncementOrder(state: HydratedIndonesiaGameState): void {
        const previousOrder = state.mergerAnnouncementOrder ?? []
        const previousIndex = state.mergerNextAnnouncerIndex ?? 0
        const previousNextAnnouncerId = previousOrder[previousIndex]
        const refreshedOrder = mergerAnnouncementOrder(state)

        state.mergerAnnouncementOrder = refreshedOrder
        if (refreshedOrder.length === 0) {
            state.mergerNextAnnouncerIndex = 0
            state.mergerVisitedAnnouncersInCycle = 0
            state.mergerAnnouncementsInCycle = 0
            return
        }

        if (previousNextAnnouncerId) {
            const carriedForwardIndex = refreshedOrder.indexOf(previousNextAnnouncerId)
            if (carriedForwardIndex >= 0) {
                state.mergerNextAnnouncerIndex = carriedForwardIndex
            } else {
                state.mergerNextAnnouncerIndex = previousIndex % refreshedOrder.length
            }
        } else {
            state.mergerNextAnnouncerIndex = previousIndex % refreshedOrder.length
        }

        state.mergerVisitedAnnouncersInCycle = Math.min(
            state.mergerVisitedAnnouncersInCycle ?? 0,
            refreshedOrder.length
        )
    }

    private maybeResolveNoFurtherMergerAnnouncements(
        state: HydratedIndonesiaGameState
    ): MachineState {
        if (
            state.pendingSiapSajiReduction ||
            (state.activeMergerProposal && state.activeMergerAuction)
        ) {
            return MachineState.Mergers
        }

        if (canAnyPlayerAnnounceMerger(state)) {
            return MachineState.Mergers
        }

        state.phaseManager.endPhase(state.actionCount)
        state.activePlayerIds = []
        state.clearActiveMergerState()
        return resolvePostMergersState(state)
    }

    private maybeFinalizeMergerAuction(state: HydratedIndonesiaGameState): void {
        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        if (!proposal || !auction) {
            return
        }

        const remainingParticipants = activeAuctionParticipantCount(auction)
        if (remainingParticipants > 1) {
            return
        }
        if (auction.highBid === undefined) {
            return
        }

        const winnerId = highestBidderId(auction)
        assertExists(winnerId, 'Merger winner should be resolved when auction finalizes')
        const winningBid = auction.highBid

        const companyA = state.companies.find((company) => company.id === proposal.companyAId)
        const companyB = state.companies.find((company) => company.id === proposal.companyBId)
        assertExists(companyA, `Company ${proposal.companyAId} should exist while resolving merger`)
        assertExists(companyB, `Company ${proposal.companyBId} should exist while resolving merger`)

        const winnerState = state.getPlayerState(winnerId)
        winnerState.cash -= winningBid

        const totalUnits = proposal.totalUnits
        assert(
            proposal.companies.length === 2,
            'Merger proposal must always include exactly two company summaries'
        )
        for (const companySummary of proposal.companies) {
            const ownerState = state.getPlayerState(companySummary.ownerId)
            const payout =
                totalUnits <= 0
                    ? 0
                    : Math.floor((winningBid * companySummary.unitCount) / totalUnits)
            ownerState.cash += payout
        }

        const mergedCompanyId = state.getPrng().randId()
        const mergedDeeds = [...companyA.deeds, ...companyB.deeds]

        const resultingGood = proposal.resultingGood
        if (proposal.companyType === CompanyType.Production) {
            assertExists(resultingGood, 'Production merger proposal must include resulting good')
        }

        const mergedProductionGood =
            proposal.companyType === CompanyType.Production
                ? proposal.isSiapSaji
                    ? Good.SiapSaji
                    : resultingGood
                : undefined
        let autoRemovedTouchingSiapSajiCount = 0

        const mergedCompany =
            proposal.companyType === CompanyType.Shipping
                ? {
                      id: mergedCompanyId,
                      type: CompanyType.Shipping,
                      deeds: mergedDeeds,
                      owner: winnerId
                  }
                : {
                      id: mergedCompanyId,
                      type: CompanyType.Production,
                      good: mergedProductionGood as Good,
                      deeds: mergedDeeds,
                      owner: winnerId
                  }

        const oldCompanyIds = new Set([companyA.id, companyB.id])
        state.companies = state.companies.filter((company) => !oldCompanyIds.has(company.id))
        state.companies.push(mergedCompany)

        for (const playerState of state.players) {
            playerState.ownedCompanies = playerState.ownedCompanies.filter(
                (companyId) => !oldCompanyIds.has(companyId)
            )
        }
        state.getPlayerState(winnerId).ownedCompanies.push(mergedCompanyId)

        if (proposal.companyType === CompanyType.Shipping) {
            for (const area of Object.values(state.board.areas)) {
                if (!isSeaArea(area) || area.ships.length === 0) {
                    continue
                }
                area.ships = area.ships.map((companyId) =>
                    oldCompanyIds.has(companyId) ? mergedCompanyId : companyId
                )
            }
        } else {
            const mergedCultivatedAreaIds: string[] = []
            for (const area of Object.values(state.board.areas)) {
                if (!isCultivatedArea(area) || !oldCompanyIds.has(area.companyId)) {
                    continue
                }
                area.companyId = mergedCompanyId
                mergedCultivatedAreaIds.push(area.id)
                if (mergedProductionGood) {
                    area.good = mergedProductionGood as Good
                }
            }
            if (proposal.isSiapSaji) {
                autoRemovedTouchingSiapSajiCount = this.autoRemoveMergedAreasTouchingExistingSiapSaji(
                    state,
                    mergedCompanyId,
                    mergedCultivatedAreaIds
                )
            }
        }

        for (const deed of mergedDeeds) {
            if (!state.mergedDeedIdsThisYear.includes(deed.id)) {
                state.mergedDeedIdsThisYear.push(deed.id)
            }
        }

        state.activeMergerProposal = undefined
        state.activeMergerAuction = undefined
        state.mergerBidOrder = undefined
        state.mergerCurrentBidderId = undefined

        if (proposal.isSiapSaji) {
            const removalsRequired = Math.ceil(totalUnits / 2)
            const removalsRemaining = Math.max(
                0,
                removalsRequired - autoRemovedTouchingSiapSajiCount
            )
            if (removalsRemaining > 0) {
                state.pendingSiapSajiReduction = {
                    companyId: mergedCompanyId,
                    winnerId,
                    removalsRemaining,
                    totalRemovals: removalsRequired
                }
                const validAreaIds = validSiapSajiRemovalAreaIds(state, mergedCompanyId)
                assert(
                    validAreaIds.length > 0,
                    'Merged siap saji company must always have at least one removable border area'
                )
                return
            }

            this.finalizeSiapSajiReduction(state, mergedCompanyId)
        }
    }

    private autoRemoveMergedAreasTouchingExistingSiapSaji(
        state: HydratedIndonesiaGameState,
        mergedCompanyId: string,
        mergedCultivatedAreaIds: readonly string[]
    ): number {
        const existingSiapSajiCompanyIdSet = new Set(
            state.companies
                .filter(
                    (company) =>
                        company.id !== mergedCompanyId &&
                        company.type === CompanyType.Production &&
                        company.good === Good.SiapSaji
                )
                .map((company) => company.id)
        )
        if (existingSiapSajiCompanyIdSet.size <= 0) {
            return 0
        }

        const areaIdsToAutoRemove = new Set<string>()
        for (const areaId of mergedCultivatedAreaIds) {
            const area = state.board.areas[areaId]
            if (!area || !isCultivatedArea(area) || area.companyId !== mergedCompanyId) {
                continue
            }

            const node = state.board.graph.nodeById(areaId)
            if (!node) {
                continue
            }

            const touchesExistingSiapSajiCompany = node.neighbors[
                IndonesiaNeighborDirection.Land
            ].some((neighborAreaId) => {
                const neighborArea = state.board.areas[neighborAreaId]
                return (
                    !!neighborArea &&
                    isCultivatedArea(neighborArea) &&
                    existingSiapSajiCompanyIdSet.has(neighborArea.companyId)
                )
            })
            if (touchesExistingSiapSajiCompany) {
                areaIdsToAutoRemove.add(areaId)
            }
        }

        for (const areaId of areaIdsToAutoRemove) {
            state.board.areas[areaId] = {
                id: areaId,
                type: AreaType.EmptyLand
            }
        }

        return areaIdsToAutoRemove.size
    }

    private queueAutoPassForIneligibleCurrentBidder(
        state: HydratedIndonesiaGameState,
        context: MachineContext<HydratedIndonesiaGameState>
    ): void {
        const currentBidderId = state.mergerCurrentBidderId
        if (!currentBidderId || !state.activeMergerProposal || !state.activeMergerAuction) {
            return
        }
        if (HydratedPlaceMergerBid.canPlaceMergerBid(state, currentBidderId)) {
            return
        }
        if (!HydratedPassMergerBid.canPassMergerBid(state, currentBidderId)) {
            return
        }
        if (this.hasPendingAutoPassMergerBid(context, currentBidderId)) {
            return
        }

        context.addSystemAction(PassMergerBid, {
            playerId: currentBidderId
        })
    }

    private hasPendingAutoPassMergerBid(
        context: MachineContext<HydratedIndonesiaGameState>,
        playerId: string
    ): boolean {
        return context
            .getPendingActions()
            .some((pendingAction) => isPassMergerBid(pendingAction) && pendingAction.playerId === playerId)
    }

    private finalizeSiapSajiReduction(state: HydratedIndonesiaGameState, companyId: string): void {
        const company = state.companies.find((candidate) => candidate.id === companyId)
        if (company && company.type === CompanyType.Production) {
            company.good = Good.SiapSaji
        }

        for (const area of Object.values(state.board.areas)) {
            if (!isCultivatedArea(area) || area.companyId !== companyId) {
                continue
            }
            area.good = Good.SiapSaji
        }
        state.pendingSiapSajiReduction = undefined
    }
}
