import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionSpace } from '../model/actionSpaces.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export type ChooseActionMetadata = Type.Static<typeof ChooseActionMetadata>
export const ChooseActionMetadata = Type.Object({
    nothingToDo: Type.Boolean()
})

export type ChooseAction = Type.Static<typeof ChooseAction>
export const ChooseAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseAction),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseActionMetadata),
            space: Type.Enum(ActionSpace)
        })
    ])
)

export const ChooseActionValidator = Compile(ChooseAction)

export function isChooseAction(action?: GameAction): action is ChooseAction {
    return action?.type === ActionType.ChooseAction
}

export class HydratedChooseAction
    extends HydratableAction<typeof ChooseAction>
    implements ChooseAction
{
    declare type: ActionType.ChooseAction
    declare playerId: string
    declare metadata?: ChooseActionMetadata
    declare space: ActionSpace

    constructor(data: ChooseAction) {
        super(data, ChooseActionValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(
            state.availableSpaces(this.playerId).includes(this.space),
            `${this.space} is not available`
        )
        state.getPlayerState(this.playerId).actionSpace = this.space
        state.turnDevelopments = []
        this.metadata = { nothingToDo: !state.canTake(this.space, this.playerId) }
    }

    static canChoose(state: HydratedHcgGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.availableSpaces(playerId).length > 0
    }
}
