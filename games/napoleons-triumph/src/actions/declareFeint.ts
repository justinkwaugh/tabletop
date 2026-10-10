import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MoveOrder } from '../model/attack.js'
import { FeintEnd, declareFeint } from '../model/attackDeclaration.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type DeclareFeint = Type.Static<typeof DeclareFeint>
export const DeclareFeint = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclareFeint),
            playerId: Type.String(),
            orders: Type.Array(MoveOrder, { minItems: 1 }),
            end: Type.Enum(FeintEnd)
        })
    ])
)

export const DeclareFeintValidator = Compile(DeclareFeint)

export function isDeclareFeint(action?: GameAction): action is DeclareFeint {
    return action?.type === ActionType.DeclareFeint
}

export class HydratedDeclareFeint
    extends HydratableAction<typeof DeclareFeint>
    implements DeclareFeint
{
    declare type: ActionType.DeclareFeint
    declare playerId: string
    declare orders: MoveOrder[]
    declare end: FeintEnd

    constructor(data: DeclareFeint) {
        super(data, DeclareFeintValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        declareFeint(state, this.orders, this.end)
    }
}
