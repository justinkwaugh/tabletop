import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionSpaceId } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export type ChooseActionMetadata = Type.Static<typeof ChooseActionMetadata>
export const ChooseActionMetadata = Type.Object({
    cost: Type.Number(),
    roundTimer: Type.Number()
})

export type ChooseAction = Type.Static<typeof ChooseAction>
export const ChooseAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseAction),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseActionMetadata),
            space: Type.Enum(ActionSpaceId)
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
    declare space: ActionSpaceId

    constructor(data: ChooseAction) {
        super(data, ChooseActionValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        assert(
            state.availableSpaces(this.playerId).includes(this.space),
            `${this.space} is not available`
        )
        const cost = state.spaceCost(this.space)
        state.roundTimer -= cost
        state.actionSpace(this.space).selections += 1
        state.activeSpace = this.space
        this.metadata = { cost, roundTimer: state.roundTimer }
    }

    static canChoose(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.availableSpaces(playerId).length > 0
    }
}
