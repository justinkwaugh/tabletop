import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ActionCategory } from '../definition/actionCategories.js'

export type ChooseActivateMetadata = Static<typeof ChooseActivateMetadata>
export const ChooseActivateMetadata = Type.Object({})

export type ChooseActivate = Static<typeof ChooseActivate>
export const ChooseActivate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseActivate),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseActivateMetadata)
        })
    ])
)

export const ChooseActivateValidator = Compile(ChooseActivate)

export function isChooseActivate(action?: GameAction): action is ChooseActivate {
    return action?.type === ActionType.ChooseActivate
}

export class HydratedChooseActivate
    extends HydratableAction<typeof ChooseActivate>
    implements ChooseActivate
{
    declare type: ActionType.ChooseActivate
    declare playerId: string
    declare actionCategory: ActionCategory
    declare metadata?: ChooseActivateMetadata
    constructor(data: ChooseActivate) {
        super(data, ChooseActivateValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        // This action does not directly modify the game state
        // though it could
    }
}
