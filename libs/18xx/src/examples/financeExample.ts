import { RouteFields, type RouteStep } from '../routes/route.js'
import { RunTrains, HydratedRunTrains, isRunTrains } from '../routes/runTrains.js'
import { RunningTrainsHandler } from '../routes/runningTrainsHandler.js'
import type { RouteRules } from '../routes/routeEvaluation.js'
import {
    TrainFields,
    type TrainInventory,
    type TrainPurchaseStep,
    type TrainState
} from '../trains/train.js'
import { BuyTrain, HydratedBuyTrain, isBuyTrain } from '../trains/buyTrain.js'
import { BuyingTrainsHandler } from '../trains/buyingTrainsHandler.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import {
    StationStep,
    type StationRules,
    StationPlacement,
    applyStationPlacement
} from '../stations/stationPlacement.js'
import { PlaceStation, HydratedPlaceStation, isPlaceStation } from '../stations/placeStation.js'
import {
    FinishStations,
    HydratedFinishStations,
    isFinishStations
} from '../stations/finishStations.js'
import {
    PlaceHomeStations,
    HydratedPlaceHomeStations,
    isPlaceHomeStations
} from '../stations/placeHomeStations.js'
import { PlacingStationHandler } from '../stations/placingStationHandler.js'
import { TrackStep, type TrackRules } from '../construction/trackConstruction.js'
import { LayTile, HydratedLayTile, isLayTile } from '../construction/layTile.js'
import { FinishTrack, HydratedFinishTrack, isFinishTrack } from '../construction/finishTrack.js'
import { LayingTrackHandler } from '../construction/layingTrackHandler.js'
import {
    StartOperatingTurn,
    HydratedStartOperatingTurn,
    isStartOperatingTurn,
    StartOperatingTurnHandler
} from '../operating/startOperatingTurn.js'
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
        Type.Literal('PlacingStation'),
        Type.Literal('StationsComplete'),
        Type.Literal('BuyingTrains'),
        Type.Literal('RunningTrains'),
        Type.Literal('TrainsRun')
    ]),
    stockRound: StockRound,
    operatingSet: Type.Optional(OperatingSet),
    trackStep: Type.Optional(TrackStep),
    stationStep: Type.Optional(StationStep),
    stockMarket: StockMarket,
    ...FinanceFields,
    ...CompanyFields,
    ...MapFields,
    ...TrainFields,
    ...RouteFields
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
    declare routeStep?: RouteStep
    declare trainInventory: TrainInventory
    declare trainPurchaseStep?: TrainPurchaseStep
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
        | 'PlacingStation'
        | 'StationsComplete'
        | 'BuyingTrains'
        | 'RunningTrains'
        | 'TrainsRun'
    declare operatingSet?: OperatingSet
    declare stationStep?: StationStep
    declare trackStep?: TrackStep
    declare stockRound: StockRound
    declare stockMarket: StockMarket
    declare companies: FinancialState['companies']
    declare bank: FinancialState['bank']
    declare certificatePools: FinancialState['certificatePools']
    declare cash: FinancialState['cash']
    declare certificates: FinancialState['certificates']
    constructor(data: FinanceExampleState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
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
        if (['LayingTrack', 'PlacingStation', 'StationsComplete'].includes(this.machineState)) {
            assert(
                this.trackStep &&
                    this.operatingSet?.companyOrder.includes(this.trackStep.companyId),
                'Track step requires an operating company'
            )
            assert(
                this.trackStep.completed === (this.machineState !== 'LayingTrack'),
                'Track completion does not match the machine state'
            )
        }
        if (this.machineState === 'PlacingStation' || this.machineState === 'StationsComplete') {
            assert(
                this.stationStep?.companyId === this.trackStep?.companyId && this.stationStep,
                'Station step requires the operating company'
            )
            assert(
                this.stationStep.completed === (this.machineState === 'StationsComplete'),
                'Station completion does not match the machine state'
            )
        }
        new RailwayMapState(map, tileSet, this.tileInventory).validateStations(this)
        depot.validateInventory(
            this.trainInventory,
            this.companies.map((company) => company.id),
            this.players.map((player) => player.playerId)
        )
        if (this.machineState === 'RunningTrains' || this.machineState === 'TrainsRun') {
            assert(
                this.routeStep &&
                    this.operatingSet?.companyOrder.includes(this.routeStep.companyId),
                'Routes require an operating company'
            )
            assert(
                (this.machineState === 'TrainsRun') === Boolean(this.routeStep.result),
                'Route result must match operation progress'
            )
        }
        if (this.machineState === 'BuyingTrains') {
            assert(
                this.trainPurchaseStep &&
                    this.operatingSet?.companyOrder.includes(this.trainPurchaseStep.companyId),
                'Train purchases require an operating company'
            )
        }
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
) => CompanyState & MapStateData & TrainState
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(
        private readonly options: Pick<
            FinanceExampleOptions,
            | 'createFinances'
            | 'createMarket'
            | 'map'
            | 'tileSet'
            | 'operatingRules'
            | 'stationRules'
            | 'trainRules'
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
            this.options.tileSet,
            this.options.trainRules.depot
        )
        if (
            position === 'construction' ||
            position === 'stations' ||
            position === 'trains' ||
            position === 'routes'
        ) {
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
            for (const home of new StationPlacement(
                initialized,
                this.options.stationRules
            ).homePlacements())
                applyStationPlacement(initialized, home)
            if (position === 'stations') {
                initialized.trackStep.completed = true
                initialized.stationStep = { companyId, placedStationIds: [], completed: false }
                initialized.machineState = 'PlacingStation'
            }
            if (position === 'trains') {
                delete initialized.trackStep
                initialized.trainPurchaseStep = { companyId, purchasedTrainIds: [] }
                initialized.machineState = 'BuyingTrains'
            }
            if (position === 'routes') {
                delete initialized.trackStep
                initialized.routeStep = { companyId }
                initialized.machineState = 'RunningTrains'
            }
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
    stationRules: StationRules
    routeRules: RouteRules
    trainRules: TrainRules
    trackRules: TrackRules
}
export function createFinanceExampleRuntime(
    options: FinanceExampleOptions
): GameRuntime<FinanceExampleState, HydratedFinanceExampleState> {
    const { stockRules: rules, companyRules, operatingRules, map, tileSet } = options
    return {
        initializer: new FinanceExampleInitializer(options),
        hydrator: {
            hydrateState: (state) =>
                new HydratedFinanceExampleState(state, map, tileSet, options.trainRules.depot),
            hydrateAction: (action) => {
                if (isRunTrains(action)) return new HydratedRunTrains(action, options.routeRules)
                if (isBuyTrain(action)) return new HydratedBuyTrain(action, options.trainRules)
                if (isPlaceStation(action))
                    return new HydratedPlaceStation(action, options.stationRules)
                if (isFinishStations(action)) return new HydratedFinishStations(action)
                if (isPlaceHomeStations(action))
                    return new HydratedPlaceHomeStations(action, options.stationRules)
                if (isLayTile(action)) return new HydratedLayTile(action, options.trackRules)
                if (isFinishTrack(action)) return new HydratedFinishTrack(action)
                if (isStartOperatingTurn(action)) return new HydratedStartOperatingTurn(action)
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
            StartOperatingTurn,
            PlaceStation,
            FinishStations,
            PlaceHomeStations,
            BuyTrain,
            RunTrains
        },
        stateHandlers: {
            StockRound: new StockRoundHandler(rules, 'StartingOperatingSet', companyRules),
            StartingOperatingSet: new StartOperatingSetHandler('OperatingSet'),
            OperatingSet: new StartOperatingTurnHandler(options.stationRules),
            LayingTrack: new LayingTrackHandler(options.trackRules, 'PlacingStation'),
            PlacingStation: new PlacingStationHandler(options.stationRules, 'RunningTrains'),
            StationsComplete: new TerminalStateHandler(),
            RunningTrains: new RunningTrainsHandler(options.routeRules, 'TrainsRun'),
            TrainsRun: new TerminalStateHandler(),
            BuyingTrains: new BuyingTrainsHandler(options.trainRules)
        }
    }
}

export function requireFinanceExampleState(state: HydratedGameState): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
