import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ConcedeMetadata = Type.Static<typeof ConcedeMetadata>
export const ConcedeMetadata = Type.Object({})

export type Concede = Type.Static<typeof Concede>
export const Concede = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Concede),
            playerId: Type.String(),
            metadata: Type.Optional(ConcedeMetadata),
        })
    ])
)

export const ConcedeValidator = Compile(Concede)

export function isConcede(action?: GameAction): action is Concede {
    return action?.type === ActionType.Concede
}

export class HydratedConcede extends HydratableAction<typeof Concede> implements Concede {
    declare type: ActionType.Concede
    declare playerId: string
    declare metadata?: ConcedeMetadata

    constructor(data: Concede) {
        super(data, ConcedeValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Concede action')
        }
        state.concededByPlayerId = this.playerId
        this.metadata = {}
    }

    isValid(_state: HydratedUrbinoGameState): boolean {
        return true
    }
}
