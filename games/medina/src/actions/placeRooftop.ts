import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Point, samePoint } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { PalaceColor } from '../components/pieces.js'
import { TileAwards, type HydratedMedinaGameState } from '../model/gameState.js'

export type PlaceRooftopMetadata = Type.Static<typeof PlaceRooftopMetadata>
export const PlaceRooftopMetadata = Type.Object({
    palaceId: Type.String(),
    color: Type.Enum(PalaceColor),
    size: Type.Number(),
    awards: TileAwards,
    teaTiles: Type.Number(),
    buildingsReturned: Type.Boolean()
})

export type PlaceRooftop = Type.Static<typeof PlaceRooftop>
export const PlaceRooftop = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRooftop),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceRooftopMetadata),
            coords: Point,
            neutral: Type.Boolean()
        })
    ])
)

export const PlaceRooftopValidator = Compile(PlaceRooftop)

export function isPlaceRooftop(action?: GameAction): action is PlaceRooftop {
    return action?.type === ActionType.PlaceRooftop
}

export class HydratedPlaceRooftop
    extends HydratableAction<typeof PlaceRooftop>
    implements PlaceRooftop
{
    declare type: ActionType.PlaceRooftop
    declare playerId: string
    declare metadata?: PlaceRooftopMetadata
    declare coords: Point
    declare neutral: boolean

    constructor(data: PlaceRooftop) {
        super(data, PlaceRooftopValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        const palace = state.palaceAt(this.coords)
        if (
            !palace ||
            !state.palaceBuildings(palace.id).some((space) => samePoint(space, this.coords)) ||
            !state
                .claimablePalaces(this.playerId, this.neutral)
                .some((candidate) => candidate.id === palace.id)
        ) {
            throw Error('Invalid PlaceRooftop action')
        }
        const player = state.getPlayerState(this.playerId)
        const teaAward =
            palace.color === PalaceColor.Purple ? state.teaTilesForNextPurpleClaim() : 0
        const owner = this.neutral ? undefined : this.playerId
        const awards = state.claimPalace(palace, this.coords, owner)
        if (this.neutral) {
            player.neutralRooftops -= 1
        } else {
            player.rooftops -= 1
            player.teaTiles += teaAward
        }
        this.metadata = {
            palaceId: palace.id,
            color: palace.color,
            size: state.palaceSize(palace.id),
            awards,
            teaTiles: this.neutral ? 0 : teaAward,
            buildingsReturned: state.returnBuildingsOnceEveryoneClaimed(palace.color)
        }
    }
}
