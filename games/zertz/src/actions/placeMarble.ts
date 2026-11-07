import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedZertzGameState, MarbleSource } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MarbleColor } from '../model/marbles.js'
import { Ring } from '../model/board.js'

export type PlaceMarbleMetadata = Type.Static<typeof PlaceMarbleMetadata>
export const PlaceMarbleMetadata = Type.Object({
    source: Type.Enum(MarbleSource),
    // Groups the placed marble filled, then groups the removed ring cut off.
    claimedOnPlacing: Type.Array(Ring),
    claimedOnRemoving: Type.Array(Ring)
})

export type PlaceMarble = Type.Static<typeof PlaceMarble>
export const PlaceMarble = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceMarble),
            playerId: Type.String(),
            color: Type.Enum(MarbleColor),
            coords: AxialCoordinates,
            // The free ring removed after placing; none when no ring is free or the placing ends
            // the game.
            remove: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(PlaceMarbleMetadata)
        })
    ])
)

export const PlaceMarbleValidator = Compile(PlaceMarble)

export function isPlaceMarble(action?: GameAction): action is PlaceMarble {
    return action?.type === ActionType.PlaceMarble
}

export class HydratedPlaceMarble
    extends HydratableAction<typeof PlaceMarble>
    implements PlaceMarble
{
    declare type: ActionType.PlaceMarble
    declare playerId: string
    declare color: MarbleColor
    declare coords: AxialCoordinates
    declare remove?: AxialCoordinates
    declare metadata?: PlaceMarbleMetadata

    constructor(data: PlaceMarble) {
        super(data, PlaceMarbleValidator)
    }

    apply(state: HydratedZertzGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceMarble action')
        }
        const placed = state.placeMarble(this.playerId, this.color, this.coords)
        const claimedOnPlacing = structuredClone(placed.claimed)
        let claimedOnRemoving: Ring[] = []
        if (this.remove !== undefined) {
            state.board.removeRing(this.remove)
            claimedOnRemoving = structuredClone(state.claimFullGroups(this.playerId))
            state.concludeMove(this.playerId)
        }
        this.metadata = { source: placed.source, claimedOnPlacing, claimedOnRemoving }
    }

    isValid(state: HydratedZertzGameState): boolean {
        if (
            state.board.hasAnyJump() ||
            !state.placeableColors(this.playerId).includes(this.color) ||
            !state.board.isVacant(this.coords)
        ) {
            return false
        }
        const removable = state.removableAfterPlacing(this.playerId, this.color, this.coords)
        const remove = this.remove
        if (remove === undefined) return removable.length === 0
        return removable.some((coords) => sameCoordinates(coords, remove))
    }
}
