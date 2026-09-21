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
import {
    FinanceFields,
    validateFinances,
    sameOwner,
    type FinancialState
} from '../finance/finance.js'

const ExampleFields = Type.Object({
    // Serialized marker retained so games created before the runtime left the examples folder keep loading.
    example: Type.Literal('finances'),
    machineState: Type.Union([
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
    ]),
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
    Omit<typeof GameState.properties, 'machineState'> & typeof ExampleFields.properties
> = Type.Object(
    {
        ...GameState.properties,
        ...ExampleFields.properties
    },
    { additionalProperties: false }
)
export type EighteenXXState = Type.Static<typeof EighteenXXState>
export const EighteenXXStateValidator: Validator<{}, typeof EighteenXXState> =
    Compile(EighteenXXState)
export class HydratedEighteenXXState
    extends HydratableGameState<typeof EighteenXXState, PlayerState>
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
    declare machineState:
        | 'StockRound'
        | 'OfferingLot'
        | 'OfferBidding'
        | 'WaterfallAuction'
        | 'AuctionBidding'
        | 'StartingOperatingSet'
        | 'OperatingSet'
        | 'LayingTrack'
        | 'PlacingStation'
        | 'StationsComplete'
        | 'BuyingTrains'
        | 'FundingTrain'
        | 'Bankrupt'
        | 'GameOver'
        | 'AdvancingPhase'
        | 'DiscardingTrains'
        | 'RustingTrains'
        | 'RunningTrains'
        | 'DistributingEarnings'
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
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(
            data instanceof HydratedEighteenXXState ? data.dehydrate() : data,
            EighteenXXStateValidator
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
            assert(
                this.operatingSet.completedCompanyIds.every((id) =>
                    this.operatingSet!.companyOrder.includes(id)
                ),
                'Completed company must belong to the operating order'
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
        if (this.openingAuction) {
            const auction = this.openingAuction
            assert(
                auction.completed !==
                    ['WaterfallAuction', 'AuctionBidding'].includes(this.machineState),
                'Opening auction progress must match its state'
            )
            assert(
                this.players.some((player) => player.playerId === auction.nextPlayerId),
                'Unknown outer auction player'
            )
            assert(
                new Set(auction.remainingLotIds).size === auction.remainingLotIds.length,
                'Duplicate auction lot'
            )
            assert(
                auction.remainingLotIds.every((id) =>
                    this.companies.some((company) => company.id === id)
                ),
                'Unknown auction lot'
            )
            assert(
                new Set(auction.reservations.map((bid) => `${bid.playerId}:${bid.lotId}`)).size ===
                    auction.reservations.length,
                'Duplicate bid commitment'
            )
            assert(
                auction.reservations.every(
                    (bid) =>
                        auction.remainingLotIds.includes(bid.lotId) &&
                        this.players.some((player) => player.playerId === bid.playerId)
                ),
                'Invalid reservation'
            )
        }
        if (this.trainFunding) {
            assert(
                ['FundingTrain', 'Bankrupt', 'GameOver'].includes(this.machineState) &&
                    this.trainFunding.purchase.companyId === this.trainPurchaseStep?.companyId,
                'Funding must belong to the operating train purchase'
            )
            assert(
                this.players.some((player) => player.playerId === this.trainFunding!.playerId),
                'Unknown funding player'
            )
            assert(
                this.trainFunding.contributors.every(
                    (owner, index, owners) =>
                        !owners.slice(0, index).some((other) => sameOwner(owner, other))
                ),
                'Duplicate funding owner'
            )
        }
        assert(
            this.machineState === 'GameOver' ||
                (this.machineState === 'Bankrupt') === Boolean(this.bankruptcy),
            'Bankruptcy must match the terminal state'
        )
        assert(
            (this.machineState === 'GameOver') === Boolean(this.finalWealth && this.result),
            'Final results must match the terminal state'
        )
        assert(this.machineState !== 'FundingTrain' || this.trainFunding, 'Missing train funding')
        if (this.privatePowerWindow)
            assert(
                this.machineState === 'OperatingSet',
                'The private power window belongs between companies'
            )
        const pendingDecisions = [
            this.purchaseOffer,
            this.privateTrackLay,
            this.trackConsent
        ].filter(Boolean)
        assert(
            pendingDecisions.length <= 1,
            'Resolve the current company decision before starting another'
        )
        if (pendingDecisions.length) {
            assert(
                [
                    'LayingTrack',
                    'PlacingStation',
                    'RunningTrains',
                    'DistributingEarnings',
                    'BuyingTrains'
                ].includes(this.machineState),
                'A company decision requires an operating decision window'
            )
            const playerId =
                this.purchaseOffer?.sellerPlayerId ??
                this.privateTrackLay?.playerId ??
                this.trackConsent?.details.consentPlayerId
            assert(
                this.players.some((player) => player.playerId === playerId),
                'Unknown player for the pending decision'
            )
        }
        new RailwayMapState(map, tileSet, this.tileInventory).validateStations(this)
        depot.validateInventory(
            this.trainInventory,
            this.companies.map((company) => company.id),
            this.players.map((player) => player.playerId)
        )
        if (this.machineState === 'RunningTrains' || this.machineState === 'DistributingEarnings') {
            assert(
                this.routeStep &&
                    this.operatingSet?.companyOrder.includes(this.routeStep.companyId),
                'Routes require an operating company'
            )
            assert(
                (this.machineState === 'DistributingEarnings') === Boolean(this.routeStep.result),
                'Route result must match operation progress'
            )
        }
        assert(
            new Set(this.phaseEvents.map((event) => event.id)).size === this.phaseEvents.length,
            'Duplicate phase occurrence'
        )
        if (this.phaseChange) {
            const change = this.phaseChange
            assert(
                ['AdvancingPhase', 'DiscardingTrains'].includes(this.machineState),
                'Pending phase change requires its decision state'
            )
            assert(
                change.continuation.companyId ===
                    (this.trainPurchaseStep?.companyId ??
                        this.trackStep?.companyId ??
                        this.stationStep?.companyId ??
                        this.routeStep?.companyId),
                'Phase continuation must preserve the operating company'
            )
            assert(
                change.discardCompanyIds.every((id) =>
                    this.companies.some((company) => company.id === id)
                ),
                'Unknown company in discard order'
            )
            assert(
                this.machineState === 'AdvancingPhase'
                    ? this.phaseId === change.event.fromPhaseId &&
                          !this.phaseEvents.some((event) => event.id === change.event.id)
                    : this.phaseId === change.event.toPhaseId &&
                          change.discardCompanyIds.length > 0 &&
                          this.phaseEvents.some((event) => event.id === change.event.id),
                'Phase effects must match pending decisions'
            )
        } else
            assert(
                !['AdvancingPhase', 'DiscardingTrains'].includes(this.machineState),
                'Missing phase change'
            )
        if (this.earningsDistribution) {
            assert(
                [
                    'BuyingTrains',
                    'FundingTrain',
                    'Bankrupt',
                    'GameOver',
                    'AdvancingPhase',
                    'DiscardingTrains'
                ].includes(this.machineState) &&
                    this.earningsDistribution.companyId === this.routeStep?.result?.companyId &&
                    this.earningsDistribution.revenue === this.routeStep.result.revenue &&
                    this.trainPurchaseStep?.companyId === this.earningsDistribution.companyId,
                'Earnings must match the completed train run and current company'
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

export function requireEighteenXXState(state: HydratedGameState): HydratedEighteenXXState {
    assert(state instanceof HydratedEighteenXXState, 'Expected hydrated 18xx state')
    return state
}

