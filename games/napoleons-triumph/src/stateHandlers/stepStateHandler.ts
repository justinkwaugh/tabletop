import { type HydratedAction, type MachineContext, type MachineStateHandler } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AttackStep } from '../model/attack.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export interface AllowedAction {
    type: ActionType
    allowed?: (state: HydratedNapoleonsTriumphGameState, playerId: string) => boolean
}

const ATTACK_STATES: Record<AttackStep, MachineState> = {
    [AttackStep.DefenseResponse]: MachineState.DefenseResponse,
    [AttackStep.FeintDecision]: MachineState.FeintDecision,
    [AttackStep.AttackDeclaration]: MachineState.AttackDeclaration,
    [AttackStep.CounterAttackDecision]: MachineState.CounterAttackDecision,
    [AttackStep.Resolving]: MachineState.ResolvingAttack,
    [AttackStep.Retreating]: MachineState.Retreating,
    [AttackStep.Occupying]: MachineState.Occupying
}

/** During play the machine state follows from the game state alone. */
export function playMachineState(state: HydratedNapoleonsTriumphGameState): MachineState {
    if (state.victory !== undefined) {
        return MachineState.EndOfGame
    }
    return state.attack ? ATTACK_STATES[state.attack.step] : MachineState.Commanding
}

/** A state in which one player chooses among a fixed set of actions. */
export abstract class StepStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedNapoleonsTriumphGameState
> {
    protected abstract readonly actions: readonly AllowedAction[]

    protected abstract actor(state: HydratedNapoleonsTriumphGameState): string

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedNapoleonsTriumphGameState>
    ): boolean {
        return this.actions.some((candidate) => candidate.type === action.type)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedNapoleonsTriumphGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== this.actor(state)) {
            return []
        }
        return this.actions
            .filter((candidate) => candidate.allowed?.(state, playerId) ?? true)
            .map((candidate) => candidate.type)
    }

    enter(context: MachineContext<HydratedNapoleonsTriumphGameState>) {
        context.gameState.activePlayerIds = [this.actor(context.gameState)]
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedNapoleonsTriumphGameState>
    ): MachineState {
        return playMachineState(context.gameState)
    }
}
