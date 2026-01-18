import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Barrier } from '../components/barrier.js'

export type PlaceBarrier = Type.Static<typeof PlaceBarrier>
export const PlaceBarrier = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBarrier),
            playerId: Type.String(),
            barrier: Barrier,
            coords: Type.Optional(OffsetCoordinates)
        })
    ])
)

export const PlaceBarrierValidator = Compile(PlaceBarrier)

export function isPlaceBarrier(action: GameAction): action is PlaceBarrier {
    return action.type === ActionType.PlaceBarrier
}

export class HydratedPlaceBarrier
    extends HydratableAction<typeof PlaceBarrier>
    implements PlaceBarrier
{
    declare type: ActionType.PlaceBarrier
    declare playerId: string
    declare barrier: Barrier
    declare coords: OffsetCoordinates

    constructor(data: PlaceBarrier) {
        super(data, PlaceBarrierValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const board = state.board
        if (!HydratedPlaceBarrier.isValidPlacement(state, this.coords, this.barrier)) {
            throw Error(
                `Barrier: ${this.barrier.value} cannot be placed at ${this.coords.row},${this.coords.col}`
            )
        }
        board.placeBarrierAtSite(this.barrier, this.coords)
        delete state.chosenPiece
    }

    static isValidPlacement(
        state: HydratedEstatesGameState,
        coords: OffsetCoordinates,
        barrier: Barrier
    ): boolean {
        return state.board.canPlaceBarrierAtSite(barrier, coords)
    }
}
