import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { InitiativeRoll, rollInitiative } from '../model/economy.js'
import { EscalationDiscards, discardEscalation } from '../model/escalation.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type RollInitiativeMetadata = Type.Static<typeof RollInitiativeMetadata>
export const RollInitiativeMetadata = Type.Object({
    rolls: Type.Array(InitiativeRoll),
    order: Type.Array(Type.String()),
    escalationDiscards: Type.Array(EscalationDiscards)
})

export type RollInitiative = Type.Static<typeof RollInitiative>
export const RollInitiative = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RollInitiative),
            metadata: Type.Optional(RollInitiativeMetadata)
        })
    ])
)

export const RollInitiativeValidator = Compile(RollInitiative)

export function isRollInitiative(action?: GameAction): action is RollInitiative {
    return action?.type === ActionType.RollInitiative
}

export class HydratedRollInitiative
    extends HydratableAction<typeof RollInitiative>
    implements RollInitiative
{
    declare type: ActionType.RollInitiative
    declare metadata?: RollInitiativeMetadata

    constructor(data: RollInitiative) {
        super(data, RollInitiativeValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const rolls = rollInitiative(state)
        // Rulebook 4.1: half the escalation markers go once the rolls are made.
        this.metadata = {
            rolls,
            order: [...state.initiativeOrder()],
            escalationDiscards: discardEscalation(state)
        }
    }
}
