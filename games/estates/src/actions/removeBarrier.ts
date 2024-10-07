import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Barrier } from '../components/barrier.js'

export type RemoveBarrier = Static<typeof RemoveBarrier>
export const RemoveBarrier = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.RemoveBarrier),
        playerId: Type.String(),
        barrier: Barrier,
        coords: Type.Optional(OffsetCoordinates)
    })
])

export const PlaceBarrierValidator = TypeCompiler.Compile(RemoveBarrier)

export function isRemoveBarrier(action: GameAction): action is RemoveBarrier {
    return action.type === ActionType.RemoveBarrier
}

export class HydratedRemoveBarrier
    extends HydratableAction<typeof RemoveBarrier>
    implements RemoveBarrier
{
    declare type: ActionType.RemoveBarrier
    declare playerId: string
    declare barrier: Barrier
    declare coords: OffsetCoordinates

    constructor(data: RemoveBarrier) {
        super(data, PlaceBarrierValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const board = state.board
        if (!HydratedRemoveBarrier.isValidPlacement(state, this.coords, this.barrier)) {
            throw Error(
                `Barrier: ${this.barrier.value} cannot be removed at ${this.coords.row},${this.coords.col}`
            )
        }
        board.removeBarrierFromSite(this.barrier, this.coords)
        delete state.chosenPiece
    }

    static isValidPlacement(
        state: HydratedEstatesGameState,
        coords: OffsetCoordinates,
        barrier: Barrier
    ): boolean {
        return state.board.canRemoveBarrierFromSite(barrier, coords)
    }
}
