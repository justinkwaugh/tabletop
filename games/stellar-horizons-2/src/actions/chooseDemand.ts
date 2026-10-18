import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TradeGood } from '../components/tradeGoods.js'
import { ActionType } from '../definition/actions.js'
import { keepDemand } from '../model/demand.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ChooseDemandMetadata = Type.Static<typeof ChooseDemandMetadata>
export const ChooseDemandMetadata = Type.Object({
    systemId: Type.String(),
    drawn: Type.Array(Type.Enum(TradeGood))
})

export type ChooseDemand = Type.Static<typeof ChooseDemand>
export const ChooseDemand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseDemand),
            playerId: Type.String(),
            good: Type.Enum(TradeGood),
            metadata: Type.Optional(ChooseDemandMetadata)
        })
    ])
)

export const ChooseDemandValidator = Compile(ChooseDemand)

export function isChooseDemand(action?: GameAction): action is ChooseDemand {
    return action?.type === ActionType.ChooseDemand
}

export class HydratedChooseDemand
    extends HydratableAction<typeof ChooseDemand>
    implements ChooseDemand
{
    declare type: ActionType.ChooseDemand
    declare playerId: string
    declare good: TradeGood
    declare metadata?: ChooseDemandMetadata

    constructor(data: ChooseDemand) {
        super(data, ChooseDemandValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const draw = state.demandDraws.at(0)
        if (draw?.playerId !== this.playerId || !draw.drawn.includes(this.good)) {
            throw Error('Invalid ChooseDemand action')
        }
        this.metadata = { systemId: draw.systemId, drawn: draw.drawn }
        keepDemand(state, this.good)
    }
}
