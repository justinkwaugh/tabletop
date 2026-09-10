import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { allPlayersPassed, type StockRoundRules } from './stockRoundRules.js'
import {
    StockMarketMove,
    companyMarketSpace,
    moveMarketSpace,
    placeStockMarker,
    stockMarketOrder
} from './stockMarket.js'
import type { StockState } from './stockState.js'

const CompletionFields = Type.Object({
    type: Type.Literal('CompleteStockRound'),
    metadata: Type.Optional(
        Type.Object(
            {
                nextPlayerOrder: Type.Array(Type.String()),
                marketMoves: Type.Array(StockMarketMove)
            },
            { additionalProperties: false }
        )
    )
})
export const CompleteStockRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompletionFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompletionFields.properties },
    { additionalProperties: false }
)
export type CompleteStockRound = Type.Static<typeof CompleteStockRound>
const Validator = Compile(CompleteStockRound)
export function isCompleteStockRound(action: GameAction): action is CompleteStockRound {
    return (
        action instanceof HydratedCompleteStockRound ||
        (action.type === 'CompleteStockRound' && Validator.Check(action))
    )
}
export class HydratedCompleteStockRound
    extends HydratableAction<typeof CompleteStockRound>
    implements CompleteStockRound
{
    declare type: 'CompleteStockRound'
    declare metadata?: CompleteStockRound['metadata']
    readonly #rules: StockRoundRules
    constructor(data: CompleteStockRound, rules: StockRoundRules) {
        super(data instanceof HydratedCompleteStockRound ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(
            this.source === ActionSource.System,
            'Stock round completion requires a system action'
        )
        assert(
            !state.stockRound.completed &&
                allPlayersPassed(state) &&
                !state.turnManager.currentTurn(),
            'The stock round is not ready to complete'
        )
        const nextPlayerOrder = this.#rules.nextPlayerOrder(state)
        assert(
            nextPlayerOrder.length === state.turnManager.turnOrder.length &&
                new Set(nextPlayerOrder).size === nextPlayerOrder.length &&
                nextPlayerOrder.every((id) => state.turnManager.turnOrder.includes(id)),
            'Invalid next player order'
        )
        const marketMoves = stockMarketOrder(state.stockMarket)
            .filter((id) => this.#rules.soldOut(state, id))
            .map((companyId) => {
                const from = companyMarketSpace(state.stockMarket, companyId)
                const to = moveMarketSpace(state.stockMarket, from.id, 'up', 1)
                return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
            })
        for (const move of marketMoves)
            placeStockMarker(state.stockMarket, move.companyId, move.toMarketSpaceId)
        state.turnManager.turnOrder = [...nextPlayerOrder]
        state.stockRound.completed = true
        this.metadata = { nextPlayerOrder, marketMoves }
    }
}
