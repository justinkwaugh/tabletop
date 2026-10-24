import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EscalationMarker } from '../components/escalation.js'
import { ActionType } from '../definition/actions.js'
import { discardDrawnEscalation } from '../model/escalation.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DiscardEscalation = Type.Static<typeof DiscardEscalation>
export const DiscardEscalation = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DiscardEscalation),
            playerId: Type.String(),
            marker: Type.Enum(EscalationMarker)
        })
    ])
)

export const DiscardEscalationValidator = Compile(DiscardEscalation)

export function isDiscardEscalation(action?: GameAction): action is DiscardEscalation {
    return action?.type === ActionType.DiscardEscalation
}

// Military Academy: one of the escalation markers just drawn goes back to the pool.
export class HydratedDiscardEscalation
    extends HydratableAction<typeof DiscardEscalation>
    implements DiscardEscalation
{
    declare type: ActionType.DiscardEscalation
    declare playerId: string
    declare marker: EscalationMarker

    constructor(data: DiscardEscalation) {
        super(data, DiscardEscalationValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (state.escalationDiscard?.playerId !== this.playerId) {
            throw Error('Invalid DiscardEscalation action')
        }
        discardDrawnEscalation(state, this.playerId, this.marker)
    }
}
