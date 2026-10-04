import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { beginTurn } from '../model/turnCycle.js'

export type StartTurnMetadata = Type.Static<typeof StartTurnMetadata>
export const StartTurnMetadata = Type.Object({
    year: Type.Number(),
    income: Type.Number(),
    arrivedShipIds: Type.Array(Type.String())
})

export type StartTurn = Type.Static<typeof StartTurn>
export const StartTurn = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.StartTurn),
            metadata: Type.Optional(StartTurnMetadata)
        })
    ])
)

export const StartTurnValidator = Compile(StartTurn)

export function isStartTurn(action?: GameAction): action is StartTurn {
    return action?.type === ActionType.StartTurn
}

export class HydratedStartTurn extends HydratableAction<typeof StartTurn> implements StartTurn {
    declare type: ActionType.StartTurn
    declare metadata?: StartTurnMetadata

    constructor(data: StartTurn) {
        super(data, StartTurnValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { year: state.year, ...beginTurn(state) }
    }
}
