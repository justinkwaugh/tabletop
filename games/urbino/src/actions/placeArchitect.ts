import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceArchitectMetadata = Type.Static<typeof PlaceArchitectMetadata>
export const PlaceArchitectMetadata = Type.Object({})

export type PlaceArchitect = Type.Static<typeof PlaceArchitect>
export const PlaceArchitect = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceArchitect),
            playerId: Type.String(),
            position: Type.Number(),
            metadata: Type.Optional(PlaceArchitectMetadata),
        })
    ])
)

export const PlaceArchitectValidator = Compile(PlaceArchitect)

export function isPlaceArchitect(action?: GameAction): action is PlaceArchitect {
    return action?.type === ActionType.PlaceArchitect
}

export class HydratedPlaceArchitect
    extends HydratableAction<typeof PlaceArchitect>
    implements PlaceArchitect
{
    declare type: ActionType.PlaceArchitect
    declare playerId: string
    declare position: number
    declare metadata?: PlaceArchitectMetadata

    constructor(data: PlaceArchitect) {
        super(data, PlaceArchitectValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceArchitect action')
        }
        state.architects[state.architectsPlaced] = this.position
        state.architectsPlaced++
        this.metadata = {}
    }

    isValid(state: HydratedUrbinoGameState): boolean {
        return (
            this.position >= 0 &&
            this.position < 81 &&
            state.board[this.position] === null &&
            this.position !== state.architects[0] &&
            this.position !== state.architects[1]
        )
    }
}
