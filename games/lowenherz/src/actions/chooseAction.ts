import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ActionCardType } from '../definition/actionCards.js'
import { buildDecisionPlan, currentDecisionPlayer, rotateToStart } from '../util/decisionPlan.js'

export type ChooseActionMetadata = Type.Static<typeof ChooseActionMetadata>
export const ChooseActionMetadata = Type.Object({})

export type ChooseAction = Type.Static<typeof ChooseAction>
export const ChooseAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.ChooseAction), // This action is always this type
            playerId: Type.String(), // Required now
            // 1 = top action, 2 = middle, 3 = bottom - matches the physical decision
            // cards, which are numbered 1/2/3 by which action they claim.
            slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
            metadata: Type.Optional(ChooseActionMetadata) // Always optional, because it is an output
        })
    ])
)

export const ChooseActionValidator = Compile(ChooseAction)

export function isChooseAction(action?: GameAction): action is ChooseAction {
    return action?.type === ActionType.ChooseAction
}

function planFor(state: HydratedLowenherzGameState): string[] {
    return buildDecisionPlan(rotateToStart(state.turnOrder, state.firstPlayerId))
}

export class HydratedChooseAction
    extends HydratableAction<typeof ChooseAction>
    implements ChooseAction
{
    declare type: ActionType.ChooseAction
    declare playerId: string
    declare slot: 1 | 2 | 3
    declare metadata?: ChooseActionMetadata

    constructor(data: ChooseAction) {
        super(data, ChooseActionValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidChooseAction(state)) {
            throw Error('Invalid ChooseAction action')
        }

        state.decisions.push({ playerId: this.playerId, slot: this.slot })
        this.metadata = {}
    }

    isValidChooseAction(state: HydratedLowenherzGameState): boolean {
        if (!HydratedChooseAction.canChooseAction(state, this.playerId)) return false

        // A player only owns one decision card of each number (1/2/3), so even when
        // they get multiple placements this round (front-loaded for 2-/3-player
        // games), they can never play the same slot twice.
        const alreadyUsedThisSlot = state.decisions.some(
            (d) => d.playerId === this.playerId && d.slot === this.slot
        )
        return !alreadyUsedThisSlot
    }

    static canChooseAction(state: HydratedLowenherzGameState, playerId: string): boolean {
        if (!state.currentActionCard || state.currentActionCard.type !== ActionCardType.Standard) {
            return false
        }
        return currentDecisionPlayer(planFor(state), state.decisions.length) === playerId
    }
}
