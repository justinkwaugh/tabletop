import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MoveOrder } from '../model/attack.js'
import { occupyAfterRetreat } from '../model/occupation.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type Occupy = Type.Static<typeof Occupy>
export const Occupy = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Occupy),
            playerId: Type.String(),
            orders: Type.Array(MoveOrder, { minItems: 1 }),
            artilleryStays: Type.Optional(Type.Literal(true))
        })
    ])
)

export const OccupyValidator = Compile(Occupy)

export function isOccupy(action?: GameAction): action is Occupy {
    return action?.type === ActionType.Occupy
}

export class HydratedOccupy extends HydratableAction<typeof Occupy> implements Occupy {
    declare type: ActionType.Occupy
    declare playerId: string
    declare orders: MoveOrder[]
    declare artilleryStays?: true

    constructor(data: Occupy) {
        super(data, OccupyValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        occupyAfterRetreat(state, this.orders, this.artilleryStays === true)
    }
}
