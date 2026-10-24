import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    AttackDeclaration,
    DeclaredAttack,
    attackDeclaration,
    declareAttack,
    isValidAttack,
    revealsAttackDraws
} from '../model/attacks.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { CombatKind } from '../model/pieces.js'

export type DeclareAttack = Type.Static<typeof DeclareAttack>
export const DeclareAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        AttackDeclaration,
        Type.Object({
            type: Type.Literal(ActionType.DeclareAttack),
            playerId: Type.String(),
            metadata: Type.Optional(DeclaredAttack)
        })
    ])
)

export const DeclareAttackValidator = Compile(DeclareAttack)

export function isDeclareAttack(action?: GameAction): action is DeclareAttack {
    return action?.type === ActionType.DeclareAttack
}

// Rulebook 1.3: in their combat turn a Player starts one combat in a system.
export class HydratedDeclareAttack
    extends HydratableAction<typeof DeclareAttack>
    implements DeclareAttack
{
    declare type: ActionType.DeclareAttack
    declare playerId: string
    declare kind: CombatKind
    declare systemId: string
    declare defenderId: string
    declare shipIds: string[]
    declare explorerId?: string
    declare metadata?: DeclaredAttack

    constructor(data: DeclareAttack) {
        super(data, DeclareAttackValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const declaration = attackDeclaration(this)
        if (
            state.remainingAttackers.at(0) !== this.playerId ||
            state.combat !== undefined ||
            state.escalationDiscard !== undefined ||
            !isValidAttack(state, this.playerId, declaration)
        ) {
            throw Error('Invalid DeclareAttack action')
        }
        this.metadata = declareAttack(state, this.playerId, declaration)
        this.revealsInfo = revealsAttackDraws(this.metadata)
    }
}
