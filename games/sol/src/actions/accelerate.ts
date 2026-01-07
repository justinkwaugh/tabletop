import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Ring } from '../utils/solGraph.js'

export type AccelerateMetadata = Static<typeof AccelerateMetadata>
export const AccelerateMetadata = Type.Object({
    sundiverId: Type.String()
})

export type Accelerate = Static<typeof Accelerate>
export const Accelerate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Accelerate),
            playerId: Type.String(),
            amount: Type.Number(),
            metadata: Type.Optional(AccelerateMetadata)
        })
    ])
)

export const AccelerateValidator = Compile(Accelerate)

export function isAccelerate(action?: GameAction): action is Accelerate {
    return action?.type === ActionType.Accelerate
}

export class HydratedAccelerate extends HydratableAction<typeof Accelerate> implements Accelerate {
    declare type: ActionType.Accelerate
    declare playerId: string
    declare amount: number
    declare metadata?: AccelerateMetadata
    constructor(data: Accelerate) {
        super(data, AccelerateValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!this.isValidAccelerate(state)) {
            throw Error('Invalid accelerate')
        }

        for (const id of Object.keys(state.board.motherships)) {
            const currentLocation = state.board.motherships[id]
            let newLocation = currentLocation - this.amount
            if (newLocation < 0) {
                newLocation += state.board.numMothershipLocations
            }
            state.board.motherships[id] = newLocation
        }
    }

    isValidAccelerate(state: HydratedSolGameState): boolean {
        return this.amount < state.board.numMothershipLocations
    }
}
