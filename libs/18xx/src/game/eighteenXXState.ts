import { GameEnding } from '../ending/gameEnding.js'
import { EndingFields, type PlayerWealth } from '../ending/finalWealth.js'
import { OfferPileFields, type OfferPileAuction } from '../auctions/offerPileAuction.js'
import { AuctionFields, type WaterfallAuction } from '../auctions/waterfallAuction.js'
import { FundingFields, type TrainFunding, type Bankruptcy } from '../funding/trainFunding.js'
import {
    CompanyDecisionFields,
    type PrivateTrackLay,
    type TrackConsent,
    type PrivatePowerWindow
} from '../privates/companyDecision.js'
import { type PurchaseOffer } from '../transfers/purchaseOffer.js'
import { PhaseFields, type PhaseEvent, type PhaseChange } from '../phases/phaseChange.js'
import { EarningsFields, type EarningsDetails } from '../earnings/earningsDistribution.js'
import { RouteFields, type RouteStep } from '../routes/route.js'
import { TrainFields, type TrainInventory, type TrainPurchaseStep } from '../trains/train.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import { StationStep } from '../stations/stationPlacement.js'
import { TrackStep } from '../construction/trackConstruction.js'
import { MapFields, RailwayMapState } from '../map/mapState.js'
import type { RailwayMap } from '../map/map.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import type { TileSet, TileInventory } from '../tiles/inventory.js'
import { OperatingSet } from '../operating/operatingSet.js'
import { CompanyFields, type CompanyState } from '../company/companyState.js'
import { validateStations } from '../map/station.js'
import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import {
    GameState,
    HydratableGameState,
    assert,
    type HydratedGameState,
    type PlayerState
} from '@tabletop/common'
import { StockMarket, validateStockMarket } from '../stock/stockMarket.js'
import { StockRound } from '../stock/stockRound.js'
import { FinanceFields, validateFinances, type FinancialState } from '../finance/finance.js'
import { validateStockRound } from '../stock/stockRound.js'
import { validateOperatingSet } from '../operating/operatingSet.js'
import { validateTrackStep } from '../construction/trackConstruction.js'
import { validateStationStep } from '../stations/stationPlacement.js'
import { validateWaterfallAuction } from '../auctions/waterfallAuction.js'
import { validateTrainFunding } from '../funding/trainFunding.js'
import { validateFinalResults } from '../ending/finalWealth.js'
import { validateCompanyDecisions } from '../privates/companyDecision.js'
import { validateRouteStep } from '../routes/route.js'
import { validatePhaseChange } from '../phases/phaseChange.js'
import { validateEarningsDistribution } from '../earnings/earningsDistribution.js'
import { validateTrainPurchaseStep } from '../trains/train.js'

const FamilyMachineState = Type.Union([
    Type.Literal('StockRound'),
    Type.Literal('OfferingLot'),
    Type.Literal('OfferBidding'),
    Type.Literal('WaterfallAuction'),
    Type.Literal('AuctionBidding'),
    Type.Literal('StartingOperatingSet'),
    Type.Literal('OperatingSet'),
    Type.Literal('LayingTrack'),
    Type.Literal('PlacingStation'),
    Type.Literal('StationsComplete'),
    Type.Literal('BuyingTrains'),
    Type.Literal('FundingTrain'),
    Type.Literal('Bankrupt'),
    Type.Literal('GameOver'),
    Type.Literal('AdvancingPhase'),
    Type.Literal('DiscardingTrains'),
    Type.Literal('RustingTrains'),
    Type.Literal('RunningTrains'),
    Type.Literal('DistributingEarnings')
])
const FamilyFields = Type.Object({
    // Serialized marker retained so games created before the runtime left the examples folder keep loading.
    example: Type.Literal('finances'),
    machineState: FamilyMachineState,
    stockRound: StockRound,
    operatingSet: Type.Optional(OperatingSet),
    trackStep: Type.Optional(TrackStep),
    stationStep: Type.Optional(StationStep),
    stockMarket: StockMarket,
    ...FinanceFields,
    ...EndingFields,
    gameEnding: Type.Optional(GameEnding),
    ...FundingFields,
    ...AuctionFields,
    ...OfferPileFields,
    ...CompanyFields,
    ...MapFields,
    ...TrainFields,
    ...PhaseFields,
    ...EarningsFields,
    ...CompanyDecisionFields,
    ...RouteFields
})
export const EighteenXXState: Type.TObject<
    Omit<typeof GameState.properties, 'machineState'> & typeof FamilyFields.properties
> = Type.Object(
    {
        ...GameState.properties,
        ...FamilyFields.properties
    },
    { additionalProperties: false }
)
export type EighteenXXMachineState = Type.Static<typeof FamilyMachineState>
type TitleMachineState = { machineState: Type.TUnsafe<string> }
type TitleStateSchema<Fields extends Type.TProperties = Record<never, never>> = Type.TObject<
    Omit<typeof EighteenXXState.properties, 'machineState'> & Fields & TitleMachineState
>
export type EighteenXXState = Type.Static<TitleStateSchema>
export type EighteenXXStateValidator = Validator<Record<never, never>, TitleStateSchema>

export function extendEighteenXXState<Fields extends Type.TProperties>(
    fields: Fields,
    machineStates: readonly string[] = []
): TitleStateSchema<Fields> {
    for (const name of [...Object.keys(fields), ...machineStates])
        assert(
            !(name in EighteenXXState.properties) &&
                !FamilyMachineState.anyOf.some((literal) => literal.const === name),
            `${name} already belongs to the 18xx family state`
        )
    return Type.Object(
        {
            ...EighteenXXState.properties,
            ...fields,
            machineState: Type.Unsafe<string>(
                Type.Union([
                    ...FamilyMachineState.anyOf,
                    ...machineStates.map((name) => Type.Literal(name))
                ])
            )
        },
        { additionalProperties: false }
    )
}
export const EighteenXXStateValidator: EighteenXXStateValidator = Compile(extendEighteenXXState({}))
export class HydratedEighteenXXState
    extends HydratableGameState<TitleStateSchema, PlayerState>
    implements EighteenXXState
{
    declare offerAuction?: OfferPileAuction
    declare openingAuction?: WaterfallAuction
    declare trainFunding?: TrainFunding
    declare bankruptcy?: Bankruptcy
    declare gameEnding?: GameEnding
    declare finalWealth?: PlayerWealth[]
    declare privatePowerWindow?: PrivatePowerWindow
    declare purchaseOffer?: PurchaseOffer
    declare privateTrackLay?: PrivateTrackLay
    declare trackConsent?: TrackConsent
    declare usedPrivatePowerIds: string[]
    declare earningsDistribution?: EarningsDetails
    declare phaseEvents: PhaseEvent[]
    declare phaseChange?: PhaseChange
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
    declare machineState: string
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
    constructor(
        data: EighteenXXState,
        map: RailwayMap,
        tileSet: TileSet,
        depot: TrainDepot,
        validator: EighteenXXStateValidator = EighteenXXStateValidator
    ) {
        super(data instanceof HydratedEighteenXXState ? data.dehydrate() : data, validator)
        assert(
            new Set(this.players.map((player) => player.playerId)).size === this.players.length,
            'Duplicate player identity'
        )
        validateStockRound(this)
        validateOperatingSet(this)
        validateTrackStep(this)
        validateStationStep(this)
        validateWaterfallAuction(this)
        validateTrainFunding(this)
        validateFinalResults(this)
        validateCompanyDecisions(this)
        new RailwayMapState(map, tileSet, this.tileInventory).validateStations(this)
        depot.validateInventory(
            this.trainInventory,
            this.companies.map((company) => company.id),
            this.players.map((player) => player.playerId)
        )
        validateRouteStep(this)
        validatePhaseChange(this)
        validateEarningsDistribution(this)
        validateTrainPurchaseStep(this)
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

export type EighteenXXStateDefinition = {
    schema: Type.TObject
    hydrate(
        data: EighteenXXState,
        map: RailwayMap,
        tileSet: TileSet,
        depot: TrainDepot
    ): HydratedEighteenXXState
}
export const FamilyStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenXXState,
    hydrate: (data, map, tileSet, depot) => new HydratedEighteenXXState(data, map, tileSet, depot)
}

export function inKnownPhase(
    state: HydratedEighteenXXState,
    phases: PhaseTable
): HydratedEighteenXXState {
    assert(phases.has(state.phaseId), `Unknown phase ${state.phaseId}`)
    return state
}

export function requireEighteenXXState(state: HydratedGameState): HydratedEighteenXXState {
    assert(state instanceof HydratedEighteenXXState, 'Expected hydrated 18xx state')
    return state
}
