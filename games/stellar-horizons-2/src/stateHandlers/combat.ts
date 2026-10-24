import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedAssignHit, isAssignHit } from '../actions/assignHit.js'
import { HydratedDeclareAttack, isDeclareAttack } from '../actions/declareAttack.js'
import { HydratedDefendAttack, isDefendAttack } from '../actions/defendAttack.js'
import { HydratedDiscardEscalation, isDiscardEscalation } from '../actions/discardEscalation.js'
import { EndCombat, HydratedEndCombat, isEndCombat } from '../actions/endCombat.js'
import { HydratedEndAttacks, isEndAttacks } from '../actions/endAttacks.js'
import { HydratedResolveRaid, isResolveRaid } from '../actions/resolveRaid.js'
import { HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { canSpendInfluence } from '../model/campaign.js'
import { currentCombatOf } from '../model/combat.js'
import { hitChooser } from '../model/hits.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterCombatStep } from './transitions.js'

// Rulebook 4.5: goods may be discarded at any time except during combat, so only IP converts.
function influenceConversion(state: HydratedStellarHorizonsGameState, playerId: string) {
    return canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : []
}

abstract class CombatStepHandler<Action extends HydratedAction> implements MachineStateHandler<
    Action | HydratedSpendInfluence,
    HydratedStellarHorizonsGameState
> {
    protected abstract readonly step: MachineState
    protected abstract readonly choices: readonly ActionType[]

    protected abstract isChoice(action: HydratedAction): action is Action

    protected abstract actingPlayer(state: HydratedStellarHorizonsGameState): string | undefined

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is Action | HydratedSpendInfluence {
        return this.isChoice(action) || isSpendInfluence(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [...this.choices, ...influenceConversion(state, playerId)]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const playerId = this.actingPlayer(context.gameState)
        context.gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        action: Action | HydratedSpendInfluence,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isSpendInfluence(action) ? this.step : stateAfterCombatStep(context.gameState)
    }
}

type AttackingAction = HydratedDeclareAttack | HydratedEndAttacks | HydratedDiscardEscalation

// Rulebook 1.3: on the Main Line in initiative order, each Player starts their combats, one
// system at a time, then ends their turn. Military Academy's discard comes straight after a
// combat's draw.
export class AttackingStateHandler extends CombatStepHandler<AttackingAction> {
    protected readonly step = MachineState.Attacking
    protected readonly choices = [ActionType.DeclareAttack, ActionType.EndAttacks]

    protected isChoice(action: HydratedAction): action is AttackingAction {
        return isDeclareAttack(action) || isEndAttacks(action) || isDiscardEscalation(action)
    }

    protected actingPlayer(state: HydratedStellarHorizonsGameState) {
        return state.remainingAttackers.at(0)
    }

    override validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.isActivePlayer(playerId) && state.escalationDiscard?.playerId === playerId) {
            return [ActionType.DiscardEscalation]
        }
        return super.validActionsForPlayer(playerId, context)
    }
}

export class DefendingStateHandler extends CombatStepHandler<HydratedDefendAttack> {
    protected readonly step = MachineState.Defending
    protected readonly choices = [ActionType.DefendAttack]

    protected isChoice(action: HydratedAction): action is HydratedDefendAttack {
        return isDefendAttack(action)
    }

    protected actingPlayer(state: HydratedStellarHorizonsGameState) {
        return currentCombatOf(state).defenderId
    }
}

export class AssigningHitsStateHandler extends CombatStepHandler<HydratedAssignHit> {
    protected readonly step = MachineState.AssigningHits
    protected readonly choices = [ActionType.AssignHit]

    protected isChoice(action: HydratedAction): action is HydratedAssignHit {
        return isAssignHit(action)
    }

    protected actingPlayer(state: HydratedStellarHorizonsGameState) {
        return hitChooser(currentCombatOf(state))
    }
}

export class ResolvingRaidStateHandler extends CombatStepHandler<HydratedResolveRaid> {
    protected readonly step = MachineState.ResolvingRaid
    protected readonly choices = [ActionType.ResolveRaid]

    protected isChoice(action: HydratedAction): action is HydratedResolveRaid {
        return isResolveRaid(action)
    }

    protected actingPlayer(state: HydratedStellarHorizonsGameState) {
        return currentCombatOf(state).attackerId
    }
}

// The escalation markers and IP after a combat; the attacker chooses only under rulebook 1.7's
// exception.
export class EndingCombatStateHandler extends CombatStepHandler<HydratedEndCombat> {
    protected readonly step = MachineState.EndingCombat
    protected readonly choices = [ActionType.EndCombat]

    protected isChoice(action: HydratedAction): action is HydratedEndCombat {
        return isEndCombat(action)
    }

    protected actingPlayer(state: HydratedStellarHorizonsGameState) {
        const combat = currentCombatOf(state)
        return combat.mayDecline ? combat.attackerId : undefined
    }

    override enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        super.enter(context)
        if (!currentCombatOf(context.gameState).mayDecline) {
            context.addSystemAction(EndCombat)
        }
    }
}
