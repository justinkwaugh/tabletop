import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type EndBlockades = Type.Static<typeof EndBlockades>
export const EndBlockades = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndBlockades),
            playerId: Type.String()
        })
    ])
)

export const EndBlockadesValidator = Compile(EndBlockades)

export function isEndBlockades(action?: GameAction): action is EndBlockades {
    return action?.type === ActionType.EndBlockades
}

export class HydratedEndBlockades
    extends HydratableAction<typeof EndBlockades>
    implements EndBlockades
{
    declare type: ActionType.EndBlockades
    declare playerId: string

    constructor(data: EndBlockades) {
        super(data, EndBlockadesValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.remainingBlockaders.at(0) !== this.playerId ||
            state.escalationDiscard !== undefined
        ) {
            throw Error('Invalid EndBlockades action')
        }
        state.remainingBlockaders = state.remainingBlockaders.slice(1)
    }
}
