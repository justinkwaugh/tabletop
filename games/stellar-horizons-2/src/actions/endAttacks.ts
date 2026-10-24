import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type EndAttacks = Type.Static<typeof EndAttacks>
export const EndAttacks = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndAttacks),
            playerId: Type.String()
        })
    ])
)

export const EndAttacksValidator = Compile(EndAttacks)

export function isEndAttacks(action?: GameAction): action is EndAttacks {
    return action?.type === ActionType.EndAttacks
}

export class HydratedEndAttacks extends HydratableAction<typeof EndAttacks> implements EndAttacks {
    declare type: ActionType.EndAttacks
    declare playerId: string

    constructor(data: EndAttacks) {
        super(data, EndAttacksValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.remainingAttackers.at(0) !== this.playerId ||
            state.combat !== undefined ||
            state.escalationDiscard !== undefined
        ) {
            throw Error('Invalid EndAttacks action')
        }
        state.remainingAttackers = state.remainingAttackers.slice(1)
    }
}
