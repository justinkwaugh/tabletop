import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { endCombat } from '../model/combat.js'
import { CombatOutcome } from '../model/pieces.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type EndCombat = Type.Static<typeof EndCombat>
export const EndCombat = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndCombat),
            // The attacker's choice under rulebook 1.7's exception; otherwise a System Action.
            declined: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(CombatOutcome)
        })
    ])
)

export const EndCombatValidator = Compile(EndCombat)

export function isEndCombat(action?: GameAction): action is EndCombat {
    return action?.type === ActionType.EndCombat
}

export class HydratedEndCombat extends HydratableAction<typeof EndCombat> implements EndCombat {
    declare type: ActionType.EndCombat
    declare declined?: boolean
    declare metadata?: CombatOutcome

    constructor(data: EndCombat) {
        super(data, EndCombatValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const combat = state.combat
        const chosen = this.declined !== undefined
        if (
            !combat ||
            chosen !== combat.mayDecline ||
            (chosen && this.playerId !== combat.attackerId)
        ) {
            throw Error('Invalid EndCombat action')
        }
        this.metadata = endCombat(state, this.declined === true)
        this.revealsInfo = (this.metadata.escalation?.drawn.length ?? 0) > 0
    }
}
