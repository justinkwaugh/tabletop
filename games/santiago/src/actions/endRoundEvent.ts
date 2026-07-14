import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'

export type DriedSquareInfo = Type.Static<typeof DriedSquareInfo>
export const DriedSquareInfo = Type.Object({
    col: Type.Number(),
    row: Type.Number(),
    crop: Type.String()
})

export type FarmerLossInfo = Type.Static<typeof FarmerLossInfo>
export const FarmerLossInfo = Type.Object({
    col: Type.Number(),
    row: Type.Number(),
    crop: Type.String(),
    playerId: Type.String()
})

export type EndRoundEvent = Type.Static<typeof EndRoundEvent>
export const EndRoundEvent = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.EndRoundEvent),
            round: Type.Number(),
            driedSquares: Type.Array(DriedSquareInfo),
            farmerLosses: Type.Array(FarmerLossInfo),
            escudosEarned: Type.Number()
        })
    ])
)

export const EndRoundEventValidator = Compile(EndRoundEvent)

export function isEndRoundEvent(action: GameAction): action is EndRoundEvent {
    return action.type === ActionType.EndRoundEvent
}

export class HydratedEndRoundEvent
    extends HydratableAction<typeof EndRoundEvent>
    implements EndRoundEvent
{
    declare type: ActionType.EndRoundEvent
    declare round: number
    declare driedSquares: DriedSquareInfo[]
    declare farmerLosses: FarmerLossInfo[]
    declare escudosEarned: number

    constructor(data: EndRoundEvent) {
        super(data, EndRoundEventValidator)
    }

    apply(_state: HydratedSantiagoGameState) {
        // Pure history marker — no game state change
    }
}
