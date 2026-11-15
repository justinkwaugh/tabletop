import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Point, samePoint } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { PalaceColor } from '../components/pieces.js'
import { TileAwards, type HydratedMedinaGameState } from '../model/gameState.js'

export type PlaceStableMetadata = Type.Static<typeof PlaceStableMetadata>
export const PlaceStableMetadata = Type.Object({
    palaceId: Type.String(),
    color: Type.Enum(PalaceColor),
    awards: Type.Optional(TileAwards)
})

export type PlaceStable = Type.Static<typeof PlaceStable>
export const PlaceStable = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceStable),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceStableMetadata),
            coords: Point
        })
    ])
)

export const PlaceStableValidator = Compile(PlaceStable)

export function isPlaceStable(action?: GameAction): action is PlaceStable {
    return action?.type === ActionType.PlaceStable
}

export class HydratedPlaceStable
    extends HydratableAction<typeof PlaceStable>
    implements PlaceStable
{
    declare type: ActionType.PlaceStable
    declare playerId: string
    declare metadata?: PlaceStableMetadata
    declare coords: Point

    constructor(data: PlaceStable) {
        super(data, PlaceStableValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const target = state.stableSpaces().find((space) => samePoint(space.coords, this.coords))
        if (player.stablesLeft() <= 0 || !target) {
            throw Error('Invalid PlaceStable action')
        }
        state.stables.push({ coords: this.coords, palaceId: target.palaceId })
        player.stables = player.stablesLeft() - 1
        const palace = state.palace(target.palaceId)
        this.metadata = {
            palaceId: palace.id,
            color: palace.color,
            awards: palace.rooftop ? state.extendClaimedPalace(palace, this.coords) : undefined
        }
    }
}
