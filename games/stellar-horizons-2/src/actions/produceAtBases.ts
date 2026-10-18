import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BaseProductionResult, produceAtBases } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ProduceAtBasesMetadata = Type.Static<typeof ProduceAtBasesMetadata>
export const ProduceAtBasesMetadata = Type.Object({
    results: Type.Array(BaseProductionResult)
})

export type ProduceAtBases = Type.Static<typeof ProduceAtBases>
export const ProduceAtBases = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ProduceAtBases),
            metadata: Type.Optional(ProduceAtBasesMetadata)
        })
    ])
)

export const ProduceAtBasesValidator = Compile(ProduceAtBases)

export function isProduceAtBases(action?: GameAction): action is ProduceAtBases {
    return action?.type === ActionType.ProduceAtBases
}

export class HydratedProduceAtBases
    extends HydratableAction<typeof ProduceAtBases>
    implements ProduceAtBases
{
    declare type: ActionType.ProduceAtBases
    declare metadata?: ProduceAtBasesMetadata

    constructor(data: ProduceAtBases) {
        super(data, ProduceAtBasesValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { results: produceAtBases(state) }
    }
}
