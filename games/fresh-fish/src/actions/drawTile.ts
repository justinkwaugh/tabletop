import { Type, type Static } from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { Tile } from '../components/tiles.js'

export type DrawTile = Static<typeof DrawTile>
export const DrawTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.DrawTile),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(
                Type.Object({
                    chosenTile: Tile
                })
            )
        })
    ])
)

export const DrawTileValidator = Compile(DrawTile)

export function isDrawTile(action: GameAction): action is DrawTile {
    return action.type === ActionType.DrawTile
}

export class HydratedDrawTile extends HydratableAction<typeof DrawTile> implements DrawTile {
    declare type: ActionType.DrawTile
    declare revealsInfo: true
    declare metadata: { chosenTile: Tile }

    constructor(data: DrawTile) {
        super(data, DrawTileValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        const drawnTile = state.tileBag.draw()
        state.chosenTile = drawnTile
    }
}
