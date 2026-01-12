import { GameAction, HydratableAction } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { ContainerColor } from '../model/container.js'

export type SelectSeizedContainer = Static<typeof SelectSeizedContainer>
export const SelectSeizedContainer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SelectSeizedContainer),
            playerId: Type.String(),
            color: Type.Enum(ContainerColor)
        })
    ])
)

export const SelectSeizedContainerValidator = Compile(SelectSeizedContainer)

export function isSelectSeizedContainer(
    action: GameAction
): action is SelectSeizedContainer {
    return action.type === ActionType.SelectSeizedContainer
}

export class HydratedSelectSeizedContainer
    extends HydratableAction<typeof SelectSeizedContainer>
    implements SelectSeizedContainer
{
    declare type: ActionType.SelectSeizedContainer
    declare playerId: string
    declare color: ContainerColor

    constructor(data: SelectSeizedContainer) {
        super(data, SelectSeizedContainerValidator)
    }

    apply(state: HydratedContainerGameState): void {
        state.applySeizureChoice(this.color)
    }
}
