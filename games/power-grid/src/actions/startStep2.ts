import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { MarketChange, beginStep2, emptyMarketChange } from './marketChange.js'

export type StartStep2 = Type.Static<typeof StartStep2>
export const StartStep2 = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.StartStep2),
            metadata: Type.Optional(MarketChange)
        })
    ])
)

export const StartStep2Validator = Compile(StartStep2)

export function isStartStep2(action?: GameAction): action is StartStep2 {
    return action?.type === ActionType.StartStep2
}

// A Step 3 card drawn as the replacement stays in the market until the end of Phase 5 (rules
// note R15).
export class HydratedStartStep2 extends HydratableAction<typeof StartStep2> implements StartStep2 {
    declare type: ActionType.StartStep2
    declare metadata?: MarketChange

    constructor(data: StartStep2) {
        super(data, StartStep2Validator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const market = beginStep2(state, emptyMarketChange())
        this.metadata = market
        this.revealsInfo = market.drawn.length > 0
    }
}
