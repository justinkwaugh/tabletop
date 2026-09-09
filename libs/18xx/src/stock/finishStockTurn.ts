import { allPlayersPassed } from './stockRoundRules.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const FinishStockTurn = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('FinishStockTurn'),
        metadata: Type.Optional(
            Type.Object({ passed: Type.Boolean() }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type FinishStockTurn = Type.Static<typeof FinishStockTurn>
const Validator = Compile(FinishStockTurn)
export function isFinishStockTurn(action: GameAction): action is FinishStockTurn {
    return (
        action instanceof HydratedFinishStockTurn ||
        (action.type === 'FinishStockTurn' && Validator.Check(action))
    )
}
export class HydratedFinishStockTurn
    extends HydratableAction<typeof FinishStockTurn>
    implements FinishStockTurn
{
    declare type: 'FinishStockTurn'
    declare playerId: string
    declare metadata?: FinishStockTurn['metadata']
    readonly #rules: StockRules
    constructor(data: FinishStockTurn, rules: StockRules) {
        super(data instanceof HydratedFinishStockTurn ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState) {
        assert(
            this.source === ActionSource.User && state.activePlayerIds.includes(this.playerId),
            'Only the acting player can finish the turn'
        )
        assert(
            !exceedsStockLimits(state, { kind: 'player', playerId: this.playerId }, this.#rules),
            'Sell down to the stock limits before finishing'
        )
        assert(!state.stockRound.completed, 'The stock round has completed')
        const passed = !state.stockRound.turn.acted
        if (passed && !state.stockRound.passedPlayerIds.includes(this.playerId))
            state.stockRound.passedPlayerIds.push(this.playerId)
        state.turnManager.endTurn(state.actionCount)
        if (!allPlayersPassed(state)) {
            state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount + 1)]
            state.stockRound.turn = {
                acted: false,
                bought: false,
                soldBeforeBuying: false,
                companiesSold: []
            }
        }
        this.metadata = { passed }
    }
}
