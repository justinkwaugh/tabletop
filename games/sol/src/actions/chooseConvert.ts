import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ActionCategory } from '../definition/actionCategories.js'

export type ChooseConvertMetadata = Static<typeof ChooseConvertMetadata>
export const ChooseConvertMetadata = Type.Object({})

export type ChooseConvert = Static<typeof ChooseConvert>
export const ChooseConvert = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseConvert),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseConvertMetadata)
        })
    ])
)

export const ChooseConvertValidator = Compile(ChooseConvert)

export function isChooseConvert(action?: GameAction): action is ChooseConvert {
    return action?.type === ActionType.ChooseConvert
}

export class HydratedChooseConvert
    extends HydratableAction<typeof ChooseConvert>
    implements ChooseConvert
{
    declare type: ActionType.ChooseConvert
    declare playerId: string
    declare actionCategory: ActionCategory
    declare metadata?: ChooseConvertMetadata
    constructor(data: ChooseConvert) {
        super(data, ChooseConvertValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        // This action does not directly modify the game state
        // though it could
    }
}
