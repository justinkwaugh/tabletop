import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedZertzGameState, MarbleSource } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MarbleColor } from '../model/marbles.js'
import { Ring } from '../model/board.js'

export type PlaceMarbleMetadata = Type.Static<typeof PlaceMarbleMetadata>
export const PlaceMarbleMetadata = Type.Object({
    source: Type.Enum(MarbleSource),
    claimedRings: Type.Array(Ring)
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
    declare metadata?: PlaceMarbleMetadata

    constructor(data: PlaceMarble) {
        super(data, PlaceMarbleValidator)
    }

    apply(state: HydratedZertzGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceMarble action')
        }
        const source = state.takeMarble(this.playerId, this.color)
        state.board.placeMarble(this.coords, this.color)
        const claimedRings = structuredClone(state.claimFullGroups(this.playerId))
        state.concludeMove(this.playerId)
        this.metadata = { source, claimedRings }
    }

    isValid(state: HydratedZertzGameState): boolean {
        return (
            !state.board.hasAnyJump() &&
            state.placeableColors(this.playerId).includes(this.color) &&
            state.board.isVacant(this.coords)
        )
    }
}
