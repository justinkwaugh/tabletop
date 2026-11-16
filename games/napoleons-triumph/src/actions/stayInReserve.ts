import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { RideEndedInReserve } from '../model/attack.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { legal } from '../model/legality.js'
import { endRideInReserve } from '../model/movement.js'

export type StayInReserve = Type.Static<typeof StayInReserve>
export const StayInReserve = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.StayInReserve),
            playerId: Type.String(),
            metadata: Type.Optional(RideEndedInReserve)
        })
    ])
)

export const StayInReserveValidator = Compile(StayInReserve)

export function isStayInReserve(action?: GameAction): action is StayInReserve {
    return action?.type === ActionType.StayInReserve
}

export class HydratedStayInReserve
    extends NapoleonsTriumphAction<typeof StayInReserve>
    implements StayInReserve
{
    declare type: ActionType.StayInReserve
    declare playerId: string
    declare metadata?: RideEndedInReserve

    constructor(data: StayInReserve) {
        super(data, StayInReserveValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        legal(state.turnPlayerId === this.playerId, 'It is not that player’s turn')
        this.metadata = endRideInReserve(state)
    }
}
