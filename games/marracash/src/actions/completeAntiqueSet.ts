import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { AntiqueSetResult, HydratedMarracashGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type CompleteAntiqueSet = Type.Static<typeof CompleteAntiqueSet>
export const CompleteAntiqueSet = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.CompleteAntiqueSet),
            collectorId: Type.String(),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(AntiqueSetResult)
        })
    ])
)

export const CompleteAntiqueSetValidator = Compile(CompleteAntiqueSet)

export function isCompleteAntiqueSet(action?: GameAction): action is CompleteAntiqueSet {
    return action?.type === ActionType.CompleteAntiqueSet
}

export class HydratedCompleteAntiqueSet
    extends HydratableAction<typeof CompleteAntiqueSet>
    implements CompleteAntiqueSet
{
    declare type: ActionType.CompleteAntiqueSet
    declare collectorId: string
    declare revealsInfo: true
    declare metadata?: AntiqueSetResult

    constructor(data: CompleteAntiqueSet) {
        super(data, CompleteAntiqueSetValidator)
    }

    apply(state: HydratedMarracashGameState) {
        this.metadata = state.completeAntiqueSet(this.collectorId)
    }
}
