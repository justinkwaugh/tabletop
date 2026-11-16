import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLyngkGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceColor } from '../model/pieces.js'

export type ClaimColor = Type.Static<typeof ClaimColor>
export const ClaimColor = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimColor),
            playerId: Type.String(),
            color: Type.Enum(PieceColor)
        })
    ])
)

export const ClaimColorValidator = Compile(ClaimColor)

export function isClaimColor(action?: GameAction): action is ClaimColor {
    return action?.type === ActionType.ClaimColor
}

export class HydratedClaimColor extends HydratableAction<typeof ClaimColor> implements ClaimColor {
    declare type: ActionType.ClaimColor
    declare playerId: string
    declare color: PieceColor

    constructor(data: ClaimColor) {
        super(data, ClaimColorValidator)
    }

    apply(state: HydratedLyngkGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid ClaimColor action')
        }
        state.claim(this.playerId, this.color)
    }

    isValid(state: HydratedLyngkGameState): boolean {
        return state.claimableColors(this.playerId).includes(this.color)
    }
}
