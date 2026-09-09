import { CompanyFields, type CompanyState } from '../company/companyState.js'
import { validateStations } from '../map/station.js'
import { StartCompany, HydratedStartCompany, isStartCompany } from '../company/startCompany.js'
import { FloatCompany, HydratedFloatCompany, isFloatCompany } from '../company/floatCompany.js'
import { FinanceExamplePosition } from './financeExamplePosition.js'
import type { CompanyRules } from '../company/companyRules.js'
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
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
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
    ...FinanceFields,
    ...CompanyFields
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
    declare phaseId: string
    declare tranches: CompanyState['tranches']
    declare ownershipLimitExemptions: CompanyState['ownershipLimitExemptions']
    declare stations: CompanyState['stations']
    declare stationReservations: CompanyState['stationReservations']
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
        validateStations(
            this,
            this.companies.map((company) => company.id)
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

const PositionValidator = Compile(FinanceExamplePosition)
const ExampleColors = [Color.Blue, Color.Red, Color.Green]
type CreateFinances = (
    players: readonly PlayerState[],
    position: FinanceExamplePosition
) => CompanyState
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(
        private readonly createFinances: CreateFinances,
        private readonly createMarket: (position: FinanceExamplePosition) => StockMarket
    ) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedFinanceExampleState {
        assert(game.players.length === 3, 'The finance example requires three players')
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: ExampleColors[index]
        }))
        const position = game.config?.examplePosition ?? 'trading'
        assert(PositionValidator.Check(position), 'Unknown finance example position')
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
            stockMarket: this.createMarket(position),
            turnManager: new HydratedTurnManager({
                series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                turnOrder: players.map((player) => player.playerId),
                turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
            }),
            ...this.createFinances(players, position)
        })
    }
}
export function createFinanceExampleRuntime(
    createFinances: CreateFinances,
    rules: StockRules,
    createMarket: (position: FinanceExamplePosition) => StockMarket,
    companyRules: CompanyRules
): GameRuntime<FinanceExampleState, HydratedFinanceExampleState> {
    return {
        initializer: new FinanceExampleInitializer(createFinances, createMarket),
        hydrator: {
            hydrateState: (state) => new HydratedFinanceExampleState(state),
            hydrateAction: (action) => {
                if (isStartCompany(action))
                    return new HydratedStartCompany(action, rules, companyRules)
                if (isFloatCompany(action)) return new HydratedFloatCompany(action, companyRules)
                if (isBuyShares(action)) return new HydratedBuyShares(action, rules)
                if (isSellShares(action)) return new HydratedSellShares(action, rules)
                if (isFinishStockTurn(action)) return new HydratedFinishStockTurn(action, rules)
                throw new Error(`Unknown finance example action: ${action.type}`)
            }
        },
        canonicalStateValidator: FinanceExampleValidator,
        playerColors: ExampleColors,
        apiActions: { BuyShares, SellShares, FinishStockTurn, StartCompany, FloatCompany },
        stateHandlers: {
            TradingShares: new StockRoundHandler(rules, 'InspectFinances', companyRules),
            InspectFinances: new TerminalStateHandler()
        }
    }
}

export function requireFinanceExampleState(state: HydratedGameState): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
