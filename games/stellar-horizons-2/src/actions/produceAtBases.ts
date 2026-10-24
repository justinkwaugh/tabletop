import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    BaseProductionResult,
    produceAtBases,
    recordProductionDirectives
} from '../model/economy.js'
import { FulfilledDirective } from '../model/pieces.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ProduceAtBasesMetadata = Type.Static<typeof ProduceAtBasesMetadata>
export const ProduceAtBasesMetadata = Type.Object({
    results: Type.Array(BaseProductionResult),
    directives: Type.Optional(Type.Array(FulfilledDirective))
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
        const results = produceAtBases(state)
        const directives = recordProductionDirectives(state, results)
        this.metadata = { results, ...(directives.length > 0 ? { directives } : {}) }
    }
}
