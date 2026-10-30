import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SkipExtraMove = Type.Static<typeof SkipExtraMove>
export const SkipExtraMove = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipExtraMove),
            playerId: Type.String()
        })
    ])
)

export const SkipExtraMoveValidator = Compile(SkipExtraMove)

export function isSkipExtraMove(action?: GameAction): action is SkipExtraMove {
    return action?.type === ActionType.SkipExtraMove
}

// The extra move is given up; its TAMSK-potential leaves the game.
export class HydratedSkipExtraMove
    extends HydratableAction<typeof SkipExtraMove>
    implements SkipExtraMove
{
    declare type: ActionType.SkipExtraMove
    declare playerId: string

    constructor(data: SkipExtraMove) {
        super(data, SkipExtraMoveValidator)
    }

    apply(state: HydratedMatrxGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid SkipExtraMove action')
        }
        state.forfeitTamsk()
    }

    isValid(state: HydratedMatrxGameState): boolean {
        return state.ownTamskOnCentre(this.playerId)
    }
}
