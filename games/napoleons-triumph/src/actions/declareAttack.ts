import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MoveOrder } from '../model/attack.js'
import { declareAttack } from '../model/attackDeclaration.js'
import { CombatMetadata, combatMetadata } from './lossRecord.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type DeclareAttack = Type.Static<typeof DeclareAttack>
export const DeclareAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareAttack),
            playerId: Type.String(),
            metadata: Type.Optional(CombatMetadata),
            orders: Type.Array(MoveOrder, { minItems: 1 }),
            wide: Type.Boolean(),
            leaderIds: Type.Array(Type.String(), { maxItems: 2 }),
            targetLeaderId: Type.Optional(Type.String())
        })
    ])
)

export const DeclareAttackValidator = Compile(DeclareAttack)

export function isDeclareAttack(action?: GameAction): action is DeclareAttack {
    return action?.type === ActionType.DeclareAttack
}

export class HydratedDeclareAttack
    extends HydratableAction<typeof DeclareAttack>
    implements DeclareAttack
{
    declare type: ActionType.DeclareAttack
    declare playerId: string
    declare metadata?: CombatMetadata
    declare orders: MoveOrder[]
    declare wide: boolean
    declare leaderIds: string[]
    declare targetLeaderId?: string

    constructor(data: DeclareAttack) {
        super(data, DeclareAttackValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const outcome = declareAttack(state, {
            orders: this.orders,
            wide: this.wide,
            leaderIds: this.leaderIds,
            targetLeaderId: this.targetLeaderId
        })
        this.metadata = combatMetadata(outcome, outcome?.finalResult ?? state.attack?.initialResult)
    }
}
