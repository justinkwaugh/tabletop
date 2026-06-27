import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'

export type SelectTile = Type.Static<typeof SelectTile>
export const SelectTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.SelectTile),
            tileIndex: Type.Number({ minimum: 0 })
        })
    ])
)

export const SelectTileValidator = Compile(SelectTile)

export function isSelectTile(action: GameAction): action is SelectTile {
    return action.type === ActionType.SelectTile
}

export class HydratedSelectTile
    extends HydratableAction<typeof SelectTile>
    implements SelectTile
{
    declare type: ActionType.SelectTile
    declare tileIndex: number

    constructor(data: SelectTile) {
        super(data, SelectTileValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        const tile = state.revealedTiles[this.tileIndex]
        if (!tile) throw new Error(`No tile at index ${this.tileIndex}`)
        const previous = state.currentPlantingTile
        state.currentPlantingTile = tile
        state.revealedTiles.splice(this.tileIndex, 1)
        if (previous) {
            state.revealedTiles.push(previous)
        }
    }
}
