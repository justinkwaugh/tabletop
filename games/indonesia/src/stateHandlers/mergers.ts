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
import { HydratedPassMergerBid, isPassMergerBid } from '../actions/passMergerBid.js'
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
import {
    activeAuctionParticipantCount,
    canAnyPlayerAnnounceMerger,
    highestBidderId,
    mergerAnnouncementOrder,
    validSiapSajiRemovalAreaIds
} from '../operations/mergers.js'
import { isCultivatedArea, isSeaArea } from '../components/area.js'
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
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isPassMergerBid(action): {
                this.maybeFinalizeMergerAuction(state)
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

        const winnerId = highestBidderId(auction)
        assertExists(winnerId, 'Merger winner should be resolved when auction finalizes')
        const winningBid = auction.highBid ?? proposal.openingBid

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
                      good: resultingGood,
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
            for (const area of Object.values(state.board.areas)) {
                if (!isCultivatedArea(area) || !oldCompanyIds.has(area.companyId)) {
                    continue
                }
                area.companyId = mergedCompanyId
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
            if (removalsRequired > 0) {
                state.pendingSiapSajiReduction = {
                    companyId: mergedCompanyId,
                    winnerId,
                    removalsRemaining: removalsRequired,
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

    private finalizeSiapSajiReduction(state: HydratedIndonesiaGameState, companyId: string): void {
        for (const area of Object.values(state.board.areas)) {
            if (!isCultivatedArea(area) || area.companyId !== companyId) {
                continue
            }
            area.good = Good.SiapSaji
        }
        state.pendingSiapSajiReduction = undefined
    }
}
