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
    HydratedMergeCompanies,
    isMergeCompanies,
    MergeCompanies
} from '../actions/mergeCompanies.js'
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
import {
    canAnyPlayerAnnounceMerger,
    mergerAnnouncementOrder,
    validSiapSajiRemovalAreaIds
} from '../operations/mergers.js'
import { resolvePostMergersState } from './operationsFlow.js'

type MergersAction =
    | HydratedProposeMerger
    | HydratedPass
    | HydratedPlaceMergerBid
    | HydratedPassMergerBid
    | HydratedMergeCompanies
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
            isMergeCompanies(action) ||
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

        if (HydratedMergeCompanies.canMergeCompanies(state)) {
            state.activePlayerIds = []
            if (!this.hasPendingMergeCompanies(context)) {
                context.addSystemAction(MergeCompanies)
            }
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
                this.queueMergeCompaniesIfReady(state, context)
                this.queueAutoPassForIneligibleCurrentBidder(state, context)
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isPassMergerBid(action): {
                this.queueMergeCompaniesIfReady(state, context)
                this.queueAutoPassForIneligibleCurrentBidder(state, context)
                return this.maybeResolveNoFurtherMergerAnnouncements(state)
            }
            case isMergeCompanies(action): {
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

        const nextAnnouncerIndex = ((state.mergerNextAnnouncerIndex ?? 0) + 1) % order.length
        state.mergerNextAnnouncerIndex = nextAnnouncerIndex

        if (announcedMerger) {
            // Any announced merger resets the consecutive pass streak.
            state.mergerVisitedAnnouncersInCycle = 0
            state.mergerAnnouncementsInCycle = 0
            return false
        }

        const consecutivePasses = (state.mergerVisitedAnnouncersInCycle ?? 0) + 1
        state.mergerVisitedAnnouncersInCycle = Math.min(consecutivePasses, order.length)
        state.mergerAnnouncementsInCycle = 0

        return consecutivePasses >= order.length
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

    private queueMergeCompaniesIfReady(
        state: HydratedIndonesiaGameState,
        context: MachineContext<HydratedIndonesiaGameState>
    ): void {
        if (!HydratedMergeCompanies.canMergeCompanies(state)) {
            return
        }
        if (this.hasPendingMergeCompanies(context)) {
            return
        }

        context.addSystemAction(MergeCompanies)
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

    private hasPendingMergeCompanies(
        context: MachineContext<HydratedIndonesiaGameState>
    ): boolean {
        return context.getPendingActions().some((pendingAction) => isMergeCompanies(pendingAction))
    }
}
