import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { MarketChange, emptyMarketChange, mergeRefill } from './marketChange.js'

export type ReplacePlant = Type.Static<typeof ReplacePlant>
export const ReplacePlant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.ReplacePlant),
            metadata: Type.Optional(MarketChange)
        })
    ])
)

export const ReplacePlantValidator = Compile(ReplacePlant)

export function isReplacePlant(action?: GameAction): action is ReplacePlant {
    return action?.type === ActionType.ReplacePlant
}

export class HydratedReplacePlant
    extends HydratableAction<typeof ReplacePlant>
    implements ReplacePlant
{
    declare type: ActionType.ReplacePlant
    declare metadata?: MarketChange

    constructor(data: ReplacePlant) {
        super(data, ReplacePlantValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        this.metadata = mergeRefill(emptyMarketChange(), state.refillMarket())
        this.revealsInfo = this.metadata.drawn.length > 0
    }
}
