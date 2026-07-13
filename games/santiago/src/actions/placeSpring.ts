import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'

export type PlaceSpring = Type.Static<typeof PlaceSpring>
export const PlaceSpring = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceSpring),
            col: Type.Number({ minimum: 0, maximum: 4 }),
            row: Type.Number({ minimum: 0, maximum: 3 })
        })
    ])
)

export const PlaceSpringValidator = Compile(PlaceSpring)

export function isPlaceSpring(action: GameAction): action is PlaceSpring {
    return action.type === ActionType.PlaceSpring
}

// One-time setup action: the first player places the spring. The four corner
// intersections are excluded — enforced by SpringPlacementStateHandler.isValidAction,
// via util/placement.ts's validSpringPlacements(), not here.
export class HydratedPlaceSpring
    extends HydratableAction<typeof PlaceSpring>
    implements PlaceSpring
{
    declare type: ActionType.PlaceSpring
    declare col: number
    declare row: number

    constructor(data: PlaceSpring) {
        super(data, PlaceSpringValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        state.board.spring = { col: this.col, row: this.row }
    }
}
