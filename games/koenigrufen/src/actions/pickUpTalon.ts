import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

// Sechserdreier: declarer takes all six talon cards unseen by the others.
export type PickUpTalon = Type.Static<typeof PickUpTalon>
export const PickUpTalon = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PickUpTalon),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const PickUpTalonValidator = Compile(PickUpTalon)

export function isPickUpTalon(action?: GameAction): action is PickUpTalon {
    return action?.type === ActionType.PickUpTalon
}

export class HydratedPickUpTalon
    extends HydratableAction<typeof PickUpTalon>
    implements PickUpTalon
{
    declare type: ActionType.PickUpTalon
    declare revealsInfo: true

    constructor(data: PickUpTalon) {
        super(data, PickUpTalonValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.pickUpTalon()
    }
}
