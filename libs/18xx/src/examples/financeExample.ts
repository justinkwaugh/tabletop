import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import {
    BaseGameInitializer,
    Color,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    TerminalStateHandler,
    assert,
    type Game,
    type GameRuntime,
    type HydratedGameState,
    type PlayerState,
    type UninitializedGameState
} from '@tabletop/common'
import { BuyShares, HydratedBuyShares, isBuyShares } from '../stock/buyShares.js'
import { TradingShares } from '../stock/tradingShares.js'
import { SellShares, HydratedSellShares, isSellShares } from '../stock/sellShares.js'
import {
    FinishStockTurn,
    HydratedFinishStockTurn,
    isFinishStockTurn
} from '../stock/finishStockTurn.js'
import { StockMarket, validateStockMarket } from '../stock/stockMarket.js'
import type { StockRules } from '../stock/stockRules.js'
import { StockRound } from '../stock/stockRound.js'
import { FinanceFields, validateFinances, type FinancialState } from '../finance/finance.js'

const ExampleFields = Type.Object({
    example: Type.Literal('finances'),
    machineState: Type.Union([Type.Literal('TradingShares'), Type.Literal('InspectFinances')]),
    stockRound: StockRound,
    stockMarket: StockMarket,
    ...FinanceFields
})
export const FinanceExampleState: Type.TObject<
    Omit<typeof GameState.properties, 'machineState'> & typeof ExampleFields.properties
> = Type.Object(
    {
        ...GameState.properties,
        ...ExampleFields.properties
    },
    { additionalProperties: false }
)
export type FinanceExampleState = Type.Static<typeof FinanceExampleState>
export const FinanceExampleValidator: Validator<{}, typeof FinanceExampleState> =
    Compile(FinanceExampleState)
export class HydratedFinanceExampleState
    extends HydratableGameState<typeof FinanceExampleState, PlayerState>
    implements FinanceExampleState
{
    declare example: 'finances'
    declare machineState: 'TradingShares' | 'InspectFinances'
    declare stockRound: StockRound
    declare stockMarket: StockMarket
    declare companies: FinancialState['companies']
    declare bank: FinancialState['bank']
    declare certificatePools: FinancialState['certificatePools']
    declare cash: FinancialState['cash']
    declare certificates: FinancialState['certificates']
    constructor(data: FinanceExampleState) {
        super(
            data instanceof HydratedFinanceExampleState ? data.dehydrate() : data,
            FinanceExampleValidator
        )
        assert(
            new Set(this.players.map((player) => player.playerId)).size === this.players.length,
            'Duplicate player identity'
        )
        validateStockMarket(
            this.stockMarket,
            this.companies.map((company) => company.id)
        )
        validateFinances(
            this,
            this.players.map((player) => player.playerId)
        )
    }
}

const ExampleColors = [Color.Blue, Color.Red, Color.Green]
type CreateFinances = (players: readonly PlayerState[]) => FinancialState
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(
        private readonly createFinances: CreateFinances,
        private readonly createMarket: () => StockMarket
    ) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedFinanceExampleState {
        assert(game.players.length === 3, 'The finance example requires three players')
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: ExampleColors[index]
        }))
        return new HydratedFinanceExampleState({
            ...state,
            players,
            activePlayerIds: [players[0].playerId],
            example: 'finances',
            machineState: 'TradingShares',
            stockRound: {
                number: 2,
                turn: { bought: false, soldBeforeBuying: false, companiesSold: [] },
                sales: [],
                companyPurchases: []
            },
            stockMarket: this.createMarket(),
            turnManager: new HydratedTurnManager({
                series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                turnOrder: players.map((player) => player.playerId),
                turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
            }),
            ...this.createFinances(players)
        })
    }
}
export function createFinanceExampleRuntime(
    createFinances: CreateFinances,
    rules: StockRules,
    createMarket: () => StockMarket
): GameRuntime<FinanceExampleState, HydratedFinanceExampleState> {
    return {
        initializer: new FinanceExampleInitializer(createFinances, createMarket),
        hydrator: {
            hydrateState: (state) => new HydratedFinanceExampleState(state),
            hydrateAction: (action) => {
                if (isBuyShares(action)) return new HydratedBuyShares(action, rules)
                if (isSellShares(action)) return new HydratedSellShares(action, rules)
                if (isFinishStockTurn(action)) return new HydratedFinishStockTurn(action, rules)
                throw new Error(`Unknown finance example action: ${action.type}`)
            }
        },
        canonicalStateValidator: FinanceExampleValidator,
        playerColors: ExampleColors,
        apiActions: { BuyShares, SellShares, FinishStockTurn },
        stateHandlers: {
            TradingShares: new TradingShares(rules, 'InspectFinances'),
            InspectFinances: new TerminalStateHandler()
        }
    }
}

export function requireFinanceExampleState(state: HydratedGameState): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
