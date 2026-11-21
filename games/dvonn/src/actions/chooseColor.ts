import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceColor } from '../model/board.js'

// `passedPlayerId` names White when the set board leaves them no first move.
export type ChooseColorMetadata = Type.Static<typeof ChooseColorMetadata>
export const ChooseColorMetadata = Type.Object({
    passedPlayerId: Type.Optional(Type.String())
})

export type ChooseColor = Type.Static<typeof ChooseColor>
export const ChooseColor = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseColor),
            playerId: Type.String(),
            color: PieceColor,
            metadata: Type.Optional(ChooseColorMetadata)
        })
    ])
)

export const ChooseColorValidator = Compile(ChooseColor)

export function isChooseColor(action?: GameAction): action is ChooseColor {
    return action?.type === ActionType.ChooseColor
}

export class HydratedChooseColor
    extends HydratableAction<typeof ChooseColor>
    implements ChooseColor
{
    declare type: ActionType.ChooseColor
    declare playerId: string
    declare color: PieceColor
    declare metadata?: ChooseColorMetadata

    constructor(data: ChooseColor) {
        super(data, ChooseColorValidator)
    }

    apply(state: HydratedDvonnGameState, _context?: MachineContext) {
        state.takeColor(this.playerId, this.color)
        this.metadata = {}
    }
}
