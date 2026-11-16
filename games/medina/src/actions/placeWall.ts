import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Tower, WallSide } from '../components/pieces.js'
import { TileAwards, type HydratedMedinaGameState } from '../model/gameState.js'
import { sameWall } from '../model/geometry.js'

export type PlaceWallMetadata = Type.Static<typeof PlaceWallMetadata>
export const PlaceWallMetadata = Type.Object({
    tower: Type.Enum(Tower),
    awards: Type.Optional(TileAwards)
})

export type PlaceWall = Type.Static<typeof PlaceWall>
export const PlaceWall = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceWall),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceWallMetadata),
            side: Type.Enum(WallSide),
            position: Type.Number()
        })
    ])
)

export const PlaceWallValidator = Compile(PlaceWall)

export function isPlaceWall(action?: GameAction): action is PlaceWall {
    return action?.type === ActionType.PlaceWall
}

export class HydratedPlaceWall extends HydratableAction<typeof PlaceWall> implements PlaceWall {
    declare type: ActionType.PlaceWall
    declare playerId: string
    declare metadata?: PlaceWallMetadata
    declare side: WallSide
    declare position: number

    constructor(data: PlaceWall) {
        super(data, PlaceWallValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const section = { side: this.side, position: this.position }
        if (
            player.wallsLeft() <= 0 ||
            !state.wallSections().some((open) => sameWall(open, section))
        ) {
            throw Error('Invalid PlaceWall action')
        }
        state.walls.push(section)
        player.walls = player.wallsLeft() - 1
        this.metadata = {
            tower: state.towerOfWall(section),
            awards: state.wallReachesPalace(section)
        }
    }
}
