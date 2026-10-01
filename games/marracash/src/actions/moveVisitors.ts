import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CardinalDirection, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedMarracashGameState, MoveResult } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { FountainIds, type FountainId } from '../components/board.js'

export type MoveVisitors = Type.Static<typeof MoveVisitors>
export const MoveVisitors = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveVisitors),
            playerId: Type.String(),
            fountainId: Type.Enum(FountainIds),
            direction: Type.Enum(CardinalDirection),
            metadata: Type.Optional(MoveResult)
        })
    ])
)

export const MoveVisitorsValidator = Compile(MoveVisitors)

export function isMoveVisitors(action?: GameAction): action is MoveVisitors {
    return action?.type === ActionType.MoveVisitors
}

export class HydratedMoveVisitors
    extends HydratableAction<typeof MoveVisitors>
    implements MoveVisitors
{
    declare type: ActionType.MoveVisitors
    declare playerId: string
    declare fountainId: FountainId
    declare direction: CardinalDirection
    declare metadata?: MoveResult

    constructor(data: MoveVisitors) {
        super(data, MoveVisitorsValidator)
    }

    apply(state: HydratedMarracashGameState) {
        if (!state.canMoveVisitors()) {
            throw Error(`Player ${this.playerId} cannot move visitors now`)
        }
        this.metadata = state.moveVisitors(this.playerId, this.fountainId, this.direction)
    }
}
