import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedTravel, isTravel } from '../actions/travel.js'
import { HydratedMuster, isMuster } from '../actions/muster.js'
import { HydratedTrade, isTrade } from '../actions/trade.js'
import { HydratedSearch, isSearch } from '../actions/search.js'
import { HydratedRecover, isRecover } from '../actions/recover.js'
import { HydratedCampaign, isCampaign } from '../actions/campaign.js'
import { HydratedEndActPhase, isEndActPhase } from '../actions/endActPhase.js'
import { HydratedForgoFreeAction, isForgoFreeAction } from '../actions/forgoFreeAction.js'
import { freeActionTypesNow } from '../util/freeActions.js'
import {
    HydratedPlayFacedownAdviser,
    isPlayFacedownAdviser
} from '../actions/playFacedownAdviser.js'
import { HydratedUseActionPower, isUseActionPower } from '../actions/useActionPower.js'
import { HydratedPeek, isPeek } from '../actions/peek.js'
import { HydratedMoveWarbands, isMoveWarbands } from '../actions/moveWarbands.js'
import { HydratedOfferCitizenship, isOfferCitizenship } from '../actions/offerCitizenship.js'
import { HydratedExileCitizen, isExileCitizen } from '../actions/exileCitizen.js'
import { HydratedSelfExile, isSelfExile } from '../actions/selfExile.js'
import { phaseAfterActPhaseAction, stateAfterCampaignDeclared } from './handlerSupport.js'

type ActionAvailability = (state: HydratedOathGameState, playerId: string) => boolean

export class ActPhaseStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    private static readonly offeredActions: ReadonlyArray<
        readonly [ActionType, ActionAvailability]
    > = [
        [ActionType.Travel, HydratedTravel.canDoTravel],
        [ActionType.Muster, HydratedMuster.canDoMuster],
        [ActionType.Trade, HydratedTrade.canDoTrade],
        [ActionType.Search, HydratedSearch.canDoSearch],
        [ActionType.Recover, HydratedRecover.canDoRecover],
        [ActionType.Campaign, HydratedCampaign.canDoCampaign],
        // R-6.1–R-6.8 — minor actions, which cost no Supply.
        [ActionType.PlayFacedownAdviser, HydratedPlayFacedownAdviser.canDoPlayFacedownAdviser],
        [ActionType.UseActionPower, HydratedUseActionPower.canDoUseActionPower],
        [ActionType.Peek, HydratedPeek.canDoPeek],
        [ActionType.MoveWarbands, HydratedMoveWarbands.canDoMoveWarbands],
        [ActionType.OfferCitizenship, HydratedOfferCitizenship.canDoOfferCitizenship],
        [ActionType.ExileCitizen, HydratedExileCitizen.canDoExileCitizen],
        [ActionType.SelfExile, HydratedSelfExile.canDoSelfExile],
        [ActionType.ForgoFreeAction, HydratedForgoFreeAction.canDoForgoFreeAction],
        // R-4.2 allows zero actions, so ending the phase is always offered.
        [ActionType.EndActPhase, HydratedEndActPhase.canDoEndActPhase]
    ]

    isValidAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): boolean {
        if (!action.playerId) return false
        return ActPhaseStateHandler.offeredTo(context.gameState, action.playerId).some(
            ([type]) => type === action.type
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return ActPhaseStateHandler.offeredTo(context.gameState, playerId)
            .filter(([, isAvailable]) => isAvailable(context.gameState, playerId))
            .map(([type]) => type)
    }

    /**
     * R-10.2 — a free Travel or Campaign a power grants comes next: while one is due, only it,
     * giving it up, or ending the phase is offered.
     */
    private static offeredTo(
        state: HydratedOathGameState,
        playerId: string
    ): ReadonlyArray<readonly [ActionType, ActionAvailability]> {
        const due = freeActionTypesNow(state, playerId)
        if (due.length === 0) return ActPhaseStateHandler.offeredActions
        return ActPhaseStateHandler.offeredActions.filter(
            ([type]) =>
                due.includes(type) ||
                type === ActionType.ForgoFreeAction ||
                type === ActionType.EndActPhase
        )
    }

    enter(_context: MachineContext<HydratedOathGameState>) {}

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        return ActPhaseStateHandler.stateAfter(action, context.gameState)
    }

    private static stateAfter(action: HydratedAction, state: HydratedOathGameState): MachineState {
        if (isCampaign(action)) {
            return stateAfterCampaignDeclared(state)
        }
        if (isMoveWarbands(action) && state.pendingConsent) {
            // R-6.5.a, R-6.5.b — the move waits on the permission it needs.
            return MachineState.ConsentRequest
        }
        if (isSearch(action)) {
            // R-5.1.3, R-5.1.4 — the cards are drawn but not yet kept or played.
            return MachineState.Searching
        }
        if (isEndActPhase(action)) {
            return MachineState.RestPhase
        }
        if (isForgoFreeAction(action)) {
            return MachineState.ActPhase
        }
        if (isOfferCitizenship(action)) {
            // R-6.6.1, R-X.1 — the offer waits on the answer; a refused offer ends nothing.
            return MachineState.ConsentRequest
        }
        // R-6.8, R-7.3.2, R-7.3.3, R-7.4 — an action may report that the Act Phase is over.
        if (isSelfExile(action)) {
            return phaseAfterActPhaseAction(action.metadata)
        }
        if (isUseActionPower(action)) {
            // Oracle keeps or discards the drawn Vision "as if you searched".
            if (action.metadata?.opensSearch) return MachineState.Searching
            return phaseAfterActPhaseAction(action.metadata)
        }
        if (isTravel(action)) {
            return phaseAfterActPhaseAction(action.metadata)
        }
        if (isPlayFacedownAdviser(action)) {
            return phaseAfterActPhaseAction(action.metadata)
        }
        if (
            isMuster(action) ||
            isTrade(action) ||
            isRecover(action) ||
            isPeek(action) ||
            isMoveWarbands(action) ||
            isExileCitizen(action)
        ) {
            return MachineState.ActPhase
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
