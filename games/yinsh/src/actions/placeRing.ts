import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedYinshGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isPoint } from '../model/geometry.js'

export type PlaceRing = Type.Static<typeof PlaceRing>
export const PlaceRing = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRing),
            playerId: Type.String(),
            coords: AxialCoordinates
        })
    ])
)

export const PlaceRingValidator = Compile(PlaceRing)

export function isPlaceRing(action?: GameAction): action is PlaceRing {
    return action?.type === ActionType.PlaceRing
}

export class HydratedPlaceRing extends HydratableAction<typeof PlaceRing> implements PlaceRing {
    declare type: ActionType.PlaceRing
    declare playerId: string
    declare coords: AxialCoordinates

    constructor(data: PlaceRing) {
        super(data, PlaceRingValidator)
    }

    apply(state: HydratedYinshGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceRing action')
        }
        state.board.placeRing(this.coords, this.playerId)
    }

    isValid(state: HydratedYinshGameState): boolean {
        return (
            isPoint(this.coords) &&
            state.board.isVacant(this.coords) &&
            state.ringsToPlace(this.playerId) > 0
        )
    }
}
