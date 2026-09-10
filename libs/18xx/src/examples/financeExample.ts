import { TrackStep, type TrackRules } from '../construction/trackConstruction.js'
import { LayTile, HydratedLayTile, isLayTile } from '../construction/layTile.js'
import { FinishTrack, HydratedFinishTrack, isFinishTrack } from '../construction/finishTrack.js'
import { LayingTrackHandler } from '../construction/layingTrackHandler.js'
import {
    StartConstruction,
    HydratedStartConstruction,
    isStartConstruction,
    StartConstructionHandler
} from '../operating/startConstruction.js'
import { controllingOwner } from '../finance/finance.js'
import { MapFields, RailwayMapState, type MapStateData } from '../map/mapState.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet, TileInventory } from '../tiles/inventory.js'
import {
    CompleteStockRound,
    HydratedCompleteStockRound,
    isCompleteStockRound
} from '../stock/completeStockRound.js'
import { OperatingSet, type OperatingRules } from '../operating/operatingSet.js'
import {
    StartOperatingSet,
    HydratedStartOperatingSet,
    isStartOperatingSet
} from '../operating/startOperatingSet.js'
import { StartOperatingSetHandler } from '../operating/startOperatingSetHandler.js'
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
    machineState: Type.Union([
        Type.Literal('StockRound'),
        Type.Literal('StartingOperatingSet'),
        Type.Literal('OperatingSet'),
        Type.Literal('LayingTrack'),
        Type.Literal('TrackComplete')
    ]),
    stockRound: StockRound,
    operatingSet: Type.Optional(OperatingSet),
    trackStep: Type.Optional(TrackStep),
    stockMarket: StockMarket,
    ...FinanceFields,
    ...CompanyFields,
    ...MapFields
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
    declare tileInventory: TileInventory
    declare phaseId: string
    declare tranches: CompanyState['tranches']
    declare ownershipLimitExemptions: CompanyState['ownershipLimitExemptions']
    declare stations: CompanyState['stations']
    declare stationReservations: CompanyState['stationReservations']
    declare example: 'finances'
    declare machineState:
        | 'StockRound'
        | 'StartingOperatingSet'
        | 'OperatingSet'
        | 'LayingTrack'
        | 'TrackComplete'
    declare operatingSet?: OperatingSet
    declare trackStep?: TrackStep
    declare stockRound: StockRound
    declare stockMarket: StockMarket
    declare companies: FinancialState['companies']
    declare bank: FinancialState['bank']
    declare certificatePools: FinancialState['certificatePools']
    declare cash: FinancialState['cash']
    declare certificates: FinancialState['certificates']
    constructor(data: FinanceExampleState, map: RailwayMap, tileSet: TileSet) {
        super(
            data instanceof HydratedFinanceExampleState ? data.dehydrate() : data,
            FinanceExampleValidator
        )
        assert(
            new Set(this.players.map((player) => player.playerId)).size === this.players.length,
            'Duplicate player identity'
        )
        assert(
            this.stockRound.passedPlayerIds.every((id) => this.turnManager.turnOrder.includes(id)),
            'Unknown passed player'
        )
        if (this.operatingSet) {
            assert(
                this.operatingSet.roundNumber <= this.operatingSet.roundCount,
                'Operating round exceeds the set length'
            )
            assert(
                this.operatingSet.companyOrder.every((id) =>
                    this.companies.some((company) => company.id === id)
                ),
                'Unknown operating company'
            )
        }
        if (this.machineState === 'LayingTrack' || this.machineState === 'TrackComplete') {
            assert(
                this.trackStep &&
                    this.operatingSet?.companyOrder.includes(this.trackStep.companyId),
                'Track step requires an operating company'
            )
            assert(
                this.trackStep.completed === (this.machineState === 'TrackComplete'),
                'Track completion does not match the machine state'
            )
        }
        new RailwayMapState(map, tileSet, this.tileInventory).validateStations(this)
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
) => CompanyState & MapStateData
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(
        private readonly options: Pick<
            FinanceExampleOptions,
            'createFinances' | 'createMarket' | 'map' | 'tileSet' | 'operatingRules'
        >
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
        const initialized = new HydratedFinanceExampleState(
            {
                ...state,
                players,
                activePlayerIds: [players[0].playerId],
                example: 'finances',
                machineState: 'StockRound',
                stockRound: {
                    number: 2,
                    completed: false,
                    passedPlayerIds: [],
                    turn: {
                        acted: false,
                        bought: false,
                        soldBeforeBuying: false,
                        companiesSold: []
                    },
                    sales: [],
                    companyPurchases: []
                },
                stockMarket: this.options.createMarket(position),
                turnManager: new HydratedTurnManager({
                    series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                    turnOrder: players.map((player) => player.playerId),
                    turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
                }),
                ...this.options.createFinances(players, position)
            },
            this.options.map,
            this.options.tileSet
        )
        if (position === 'construction') {
            const companyOrder = this.options.operatingRules.companyOrder(initialized)
            const companyId = companyOrder[0]
            const owner = controllingOwner(initialized, companyId)
            assert(owner, 'Construction example requires a controlling owner')
            initialized.stockRound.completed = true
            initialized.operatingSet = {
                number: 1,
                roundNumber: 1,
                roundCount: this.options.operatingRules.roundCount(initialized),
                companyOrder
            }
            initialized.trackStep = { companyId, lays: [], completed: false }
            initialized.machineState = 'LayingTrack'
            initialized.activePlayerIds = [owner.playerId]
            initialized.turnManager.series = [{ type: 'turn', playerId: owner.playerId, start: 0 }]
        }
        return initialized
    }
}
export interface FinanceExampleOptions {
    createFinances: CreateFinances
    stockRules: StockRules
    createMarket: (position: FinanceExamplePosition) => StockMarket
    companyRules: CompanyRules
    operatingRules: OperatingRules
    map: RailwayMap
    tileSet: TileSet
    trackRules: TrackRules
}
export function createFinanceExampleRuntime(
    options: FinanceExampleOptions
): GameRuntime<FinanceExampleState, HydratedFinanceExampleState> {
    const { stockRules: rules, companyRules, operatingRules, map, tileSet } = options
    return {
        initializer: new FinanceExampleInitializer(options),
        hydrator: {
            hydrateState: (state) => new HydratedFinanceExampleState(state, map, tileSet),
            hydrateAction: (action) => {
                if (isLayTile(action)) return new HydratedLayTile(action, options.trackRules)
                if (isFinishTrack(action)) return new HydratedFinishTrack(action)
                if (isStartConstruction(action)) return new HydratedStartConstruction(action)
                if (isCompleteStockRound(action))
                    return new HydratedCompleteStockRound(action, rules.round)
                if (isStartOperatingSet(action))
                    return new HydratedStartOperatingSet(action, operatingRules)
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
        apiActions: {
            BuyShares,
            SellShares,
            FinishStockTurn,
            StartCompany,
            FloatCompany,
            CompleteStockRound,
            StartOperatingSet,
            LayTile,
            FinishTrack,
            StartConstruction
        },
        stateHandlers: {
            StockRound: new StockRoundHandler(rules, 'StartingOperatingSet', companyRules),
            StartingOperatingSet: new StartOperatingSetHandler('OperatingSet'),
            OperatingSet: new StartConstructionHandler(),
            LayingTrack: new LayingTrackHandler(options.trackRules, 'TrackComplete'),
            TrackComplete: new TerminalStateHandler()
        }
    }
}

export function requireFinanceExampleState(state: HydratedGameState): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
