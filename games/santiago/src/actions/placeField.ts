import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { SquareType } from '../model/board.js'

export type PlaceField = Type.Static<typeof PlaceField>
export const PlaceField = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceField),
            col: Type.Number({ minimum: 0, maximum: 7 }),
            row: Type.Number({ minimum: 0, maximum: 5 })
        })
    ])
)

export const PlaceFieldValidator = Compile(PlaceField)

export function isPlaceField(action: GameAction): action is PlaceField {
    return action.type === ActionType.PlaceField
}

export class HydratedPlaceField
    extends HydratableAction<typeof PlaceField>
    implements PlaceField
{
    declare type: ActionType.PlaceField
    declare col: number
    declare row: number

    constructor(data: PlaceField) {
        super(data, PlaceFieldValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (!this.playerId) throw new Error('PlaceField requires a playerId')
        const tile = state.currentPlantingTile
        if (!tile) throw new Error('No planting tile available')

        const existing = state.board.squares[this.col][this.row]
        if (existing.type !== SquareType.Empty) {
            throw new Error(`Square (${this.col},${this.row}) is not empty`)
        }

        // Canal overseer who bid zero places one fewer farmer (minimum 0).
        const penaltyApplies =
            this.playerId === state.canalOverseerId && state.overseerBidZero
        const farmerCount = penaltyApplies
            ? Math.max(0, tile.farmerCapacity - 1)
            : tile.farmerCapacity

        state.board.squares[this.col][this.row] = {
            type: SquareType.Field,
            crop: tile.crop,
            playerId: this.playerId,
            farmerCapacity: tile.farmerCapacity,
            farmerCount,
            hasPalmTree: existing.hasPalmTree,
            dried: false
        }

        state.currentPlantingTile = undefined
    }
}
