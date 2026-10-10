import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { isCampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedCampaignDefend, isCampaignDefend } from '../actions/campaignDefend.js'
import {
    HydratedCampaignAttackPlans,
    isCampaignAttackPlans
} from '../actions/campaignAttackPlans.js'
import {
    HydratedCampaignDefeatKills,
    isCampaignDefeatKills
} from '../actions/campaignDefeatKills.js'
import {
    HydratedCampaignSkullLosses,
    isCampaignSkullLosses
} from '../actions/campaignSkullLosses.js'
import {
    giveClockTo,
    isPlayerActionOfType,
    stateAfterCampaignDeclared,
    stateAfterCampaignEnded,
    stateAfterCampaignRoll
} from './handlerSupport.js'

/** R-5.5.3, R-7.5.2 — mid-Campaign, before the roll: the attacker's plans after allies join, then the defending side's. */
export class CampaignPlansStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return (
            isPlayerActionOfType(action, ActionType.CampaignDefend) ||
            isPlayerActionOfType(action, ActionType.CampaignAttackPlans)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const state = context.gameState
        if (HydratedCampaignAttackPlans.attackerId(state) === playerId) {
            return [ActionType.CampaignAttackPlans]
        }
        return HydratedCampaignDefend.canDoCampaignDefend(state, playerId)
            ? [ActionType.CampaignDefend]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const state = context.gameState
        giveClockTo(
            state,
            HydratedCampaignAttackPlans.attackerId(state) ??
                HydratedCampaignDefend.answeringPlayerId(state)
        )
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isCampaignAttackPlans(action)) return stateAfterCampaignDeclared(context.gameState)
        if (isCampaignDefend(action)) {
            // R-5.5.3.a — nothing is rolled until the last ally has answered.
            if (context.gameState.campaign?.pendingDefenderPlans) {
                return MachineState.CampaignPlans
            }
            return stateAfterCampaignRoll(context.gameState)
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}

/** R-5.5.5 — from revision 7 the attacker picks where the skulls kill; out of turn too (Sneak Attack). */
export class CampaignSkullLossesStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.CampaignSkullLosses)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedCampaignSkullLosses.canDoCampaignSkullLosses(context.gameState, playerId)
            ? [ActionType.CampaignSkullLosses]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        giveClockTo(context.gameState, context.gameState.campaign?.attackerPlayerId)
    }

    onAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): MachineState {
        if (isCampaignSkullLosses(action)) return MachineState.CampaignSacrifice
        throw Error(`Unhandled action type: ${action.type}`)
    }
}

/** R-5.5.5, R-4.2 — after the roll the attacker may only finish the battle. */
export class CampaignSacrificeStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.CampaignSacrifice)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return context.gameState.campaign?.attackerPlayerId === playerId
            ? [ActionType.CampaignSacrifice]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        giveClockTo(context.gameState, context.gameState.campaign?.attackerPlayerId)
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isCampaignSacrifice(action)) {
            const campaign = context.gameState.campaign
            // R-5.5.6.a — the defeated defending side chooses its losses first.
            if (campaign?.pendingDefeatKills) return MachineState.CampaignDefeat
            // R-5.5.7 — only a victor goes on; `apply()` has already cleared a defeat.
            return campaign
                ? MachineState.CampaignVictory
                : stateAfterCampaignEnded(context.gameState, action.metadata)
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}

/** R-5.5.6.a */
export class CampaignDefeatStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.CampaignDefeatKills)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedCampaignDefeatKills.canDoCampaignDefeatKills(context.gameState, playerId)
            ? [ActionType.CampaignDefeatKills]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        giveClockTo(context.gameState, HydratedCampaignDefeatKills.chooserId(context.gameState))
    }

    onAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): MachineState {
        // Only a victorious attacker's opponents choose, so R-5.5.7 follows.
        if (isCampaignDefeatKills(action)) return MachineState.CampaignVictory
        throw Error(`Unhandled action type: ${action.type}`)
    }
}

/** R-5.5.7.I — "from your force", whose size is known only after the sacrifice. */
export class CampaignVictoryStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.CampaignResolveVictory)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return context.gameState.campaign?.attackerPlayerId === playerId
            ? [ActionType.CampaignResolveVictory]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        giveClockTo(context.gameState, context.gameState.campaign?.attackerPlayerId)
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isCampaignResolveVictory(action)) {
            return stateAfterCampaignEnded(context.gameState, action.metadata)
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
