import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { SquareType } from '../model/board.js'

export type PlaceNeutralTile = Type.Static<typeof PlaceNeutralTile>
export const PlaceNeutralTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceNeutralTile),
            col: Type.Number({ minimum: 0, maximum: 7 }),
            row: Type.Number({ minimum: 0, maximum: 5 })
        })
    ])
)

export const PlaceNeutralTileValidator = Compile(PlaceNeutralTile)

export function isPlaceNeutralTile(action: GameAction): action is PlaceNeutralTile {
    return action.type === ActionType.PlaceNeutralTile
}

// Placed by the highest bidder in 3-player games for the leftover (4th) tile.
// The plantation has no owner and no farmers — it contributes to plantation size
// for adjacent same-crop groups but scores nothing itself.
export class HydratedPlaceNeutralTile
    extends HydratableAction<typeof PlaceNeutralTile>
    implements PlaceNeutralTile
{
    declare type: ActionType.PlaceNeutralTile
    declare col: number
    declare row: number

    constructor(data: PlaceNeutralTile) {
        super(data, PlaceNeutralTileValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        const tile = state.revealedTiles[0]
        if (!tile) throw new Error('No neutral tile available to place')

        const existing = state.board.squares[this.col][this.row]
        if (existing.type !== SquareType.Empty) {
            throw new Error(`Square (${this.col},${this.row}) is not empty`)
        }

        // Neutral plantation: empty string playerId means no owner.
        // farmerCount = 0 (no farmers placed), but hasPalmTree is inherited.
        state.board.squares[this.col][this.row] = {
            type: SquareType.Field,
            crop: tile.crop,
            playerId: '',
            farmerCapacity: tile.farmerCapacity,
            farmerCount: 0,
            hasPalmTree: existing.hasPalmTree,
            dried: false
        }

        state.revealedTiles.splice(0, 1)
    }
}
