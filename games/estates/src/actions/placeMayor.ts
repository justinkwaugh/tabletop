import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceMayor = Type.Static<typeof PlaceMayor>
export const PlaceMayor = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceMayor),
            playerId: Type.String(),
            row: Type.Optional(Type.Number())
        })
    ])
)

export const PlaceMayorValidator = Compile(PlaceMayor)

export function isPlaceMayor(action: GameAction): action is PlaceMayor {
    return action.type === ActionType.PlaceMayor
}

export class HydratedPlaceMayor extends HydratableAction<typeof PlaceMayor> implements PlaceMayor {
    declare type: ActionType.PlaceMayor
    declare playerId: string
    declare row: number

    constructor(data: PlaceMayor) {
        super(data, PlaceMayorValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const board = state.board

        if ((this.row !== undefined && this.row < 0) || this.row > 2) {
            throw Error(`Row: ${this.row} is out of bounds`)
        }

        if (this.row !== undefined) {
            board.placeMayorAtRow(this.row)
        }
        delete state.chosenPiece
    }
}
