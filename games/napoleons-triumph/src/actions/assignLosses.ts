import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DecisionKind } from '../model/attack.js'
import { assignExcessLosses, assignOddLoss, nextDecision } from '../model/attackFlow.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { CombatMetadata, combatMetadata } from './lossRecord.js'

export type AssignLosses = Type.Static<typeof AssignLosses>
export const AssignLosses = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AssignLosses),
            playerId: Type.String(),
            metadata: Type.Optional(CombatMetadata),
            /** Steps each unit takes. An odd loss names one of the two leading units with one step. */
            allocation: Type.Record(Type.String(), Type.Integer({ minimum: 1 }))
        })
    ])
)

export const AssignLossesValidator = Compile(AssignLosses)

export function isAssignLosses(action?: GameAction): action is AssignLosses {
    return action?.type === ActionType.AssignLosses
}

export class HydratedAssignLosses
    extends HydratableAction<typeof AssignLosses>
    implements AssignLosses
{
    declare type: ActionType.AssignLosses
    declare playerId: string
    declare metadata?: CombatMetadata
    declare allocation: Record<string, number>

    constructor(data: AssignLosses) {
        super(data, AssignLossesValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const decision = nextDecision(state)
        if (decision?.kind === DecisionKind.OddLoss) {
            const [unitId, ...rest] = Object.keys(this.allocation)
            assert(rest.length === 0 && this.allocation[unitId] === 1, 'An odd loss is one step on one unit')
            this.metadata = combatMetadata(assignOddLoss(state, this.playerId, unitId))
            return
        }
        this.metadata = combatMetadata(assignExcessLosses(state, this.playerId, this.allocation))
    }
}
