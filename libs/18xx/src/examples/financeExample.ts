import { AutomaticTrackCompletionHandler } from '../construction/automaticTrackCompletionHandler.js'
import { AutomaticTrainCompletionHandler } from '../trains/automaticTrainCompletionHandler.js'
import { GameEnding, type EndingRules } from '../ending/gameEnding.js'
import { EndingFields, type PlayerWealth } from '../ending/finalWealth.js'
import {
    ScheduleGameEnd,
    HydratedScheduleGameEnd,
    isScheduleGameEnd
} from '../ending/scheduleGameEnd.js'
import { EndGame, HydratedEndGame, isEndGame } from '../ending/endGame.js'
import { GameEndingHandler } from '../ending/gameEndingHandler.js'
import type { MachineStateHandler, HydratedAction } from '@tabletop/common'
import { Prng } from '@tabletop/common'
import {
    OfferPileFields,
    type OfferPileAuction,
    type OfferPileAuctionRules
} from '../auctions/offerPileAuction.js'
import {
    OfferAuctionLot,
    HydratedOfferAuctionLot,
    isOfferAuctionLot
} from '../auctions/offerAuctionLot.js'
import {
    BidOnAuctionLot,
    HydratedBidOnAuctionLot,
    isBidOnAuctionLot
} from '../auctions/bidOnAuctionLot.js'
import { OfferAuctionHandler } from '../auctions/offerAuctionHandler.js'
import {
    AuctionFields,
    type WaterfallAuction,
    type WaterfallAuctionRules
} from '../auctions/waterfallAuction.js'
import { ReserveBid, HydratedReserveBid, isReserveBid } from '../auctions/reserveBid.js'
import {
    RaiseAuctionBid,
    HydratedRaiseAuctionBid,
    isRaiseAuctionBid
} from '../auctions/raiseAuctionBid.js'
import { BuyAuctionLot, HydratedBuyAuctionLot, isBuyAuctionLot } from '../auctions/buyAuctionLot.js'
import { PassAuction, HydratedPassAuction, isPassAuction } from '../auctions/passAuction.js'
import {
    ResolveAuction,
    HydratedResolveAuction,
    isResolveAuction
} from '../auctions/resolveAuction.js'
import { WaterfallAuctionHandler } from '../auctions/waterfallAuctionHandler.js'
import {
    FundingFields,
    type TrainFunding,
    type Bankruptcy,
    type TrainFundingRules
} from '../funding/trainFunding.js'
import { FundingTrainHandler } from '../funding/fundingTrainHandler.js'
import { BankruptHandler } from '../funding/bankruptHandler.js'
import { FundTrain, HydratedFundTrain, isFundTrain } from '../funding/fundTrain.js'
import {
    IssueTreasuryShares,
    HydratedIssueTreasuryShares,
    isIssueTreasuryShares
} from '../funding/issueTreasuryShares.js'
import {
    SellFundingShares,
    HydratedSellFundingShares,
    isSellFundingShares
} from '../funding/sellFundingShares.js'
import {
    ContributeTrainFunds,
    HydratedContributeTrainFunds,
    isContributeTrainFunds
} from '../funding/contributeTrainFunds.js'
import {
    DeclareBankruptcy,
    HydratedDeclareBankruptcy,
    isDeclareBankruptcy
} from '../funding/declareBankruptcy.js'
import { isContinueOperatingRound } from '../privates/betweenCompaniesHandler.js'
import { isBuyPrivateTrain } from '../privates/buyPrivateTrain.js'
import { isLayPrivateTile, isDeclinePrivateTile } from '../privates/layPrivateTile.js'
import { isRequestTrackConsent, isRespondToTrackConsent } from '../construction/trackConsent.js'
import { isOfferPurchase, isRespondToPurchaseOffer } from '../transfers/offerPurchase.js'
import {
    BetweenCompaniesHandler,
    ContinueOperatingRound,
    HydratedContinueOperatingRound
} from '../privates/betweenCompaniesHandler.js'
import {
    CompanyDecisionFields,
    type PrivateTrackLay,
    type TrackConsent,
    type PrivatePowerWindow
} from '../privates/companyDecision.js'
import { type PurchaseOffer, type TransferRules } from '../transfers/purchaseOffer.js'
import { type PrivatePowerRules } from '../privates/privatePowers.js'
import { CompanyDecisionsHandler } from '../privates/companyDecisionsHandler.js'
import {
    OfferPurchase,
    HydratedOfferPurchase,
    RespondToPurchaseOffer,
    HydratedRespondToPurchaseOffer
} from '../transfers/offerPurchase.js'
import {
    RequestTrackConsent,
    HydratedRequestTrackConsent,
    RespondToTrackConsent,
    HydratedRespondToTrackConsent
} from '../construction/trackConsent.js'
import {
    LayPrivateTile,
    HydratedLayPrivateTile,
    DeclinePrivateTile,
    HydratedDeclinePrivateTile
} from '../privates/layPrivateTile.js'
import { BuyPrivateTrain, HydratedBuyPrivateTrain } from '../privates/buyPrivateTrain.js'
import {
    ExchangePrivate,
    HydratedExchangePrivate,
    isExchangePrivate
} from '../privates/exchangePrivate.js'
import { PrivateExchangeHandler } from '../privates/privateExchangeHandler.js'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import type { PrivateRules } from '../privates/privateRules.js'
import {
    PhaseFields,
    type PhaseEvent,
    type PhaseChange,
    type PhaseRules
} from '../phases/phaseChange.js'
import {
    AdvancePhase,
    HydratedAdvancePhase,
    isAdvancePhase,
    AdvancingPhaseHandler
} from '../phases/advancePhase.js'
import {
    DiscardTrain,
    HydratedDiscardTrain,
    isDiscardTrain,
    DiscardingTrainsHandler
} from '../trains/discardTrain.js'
import {
    RustTrains,
    HydratedRustTrains,
    isRustTrains,
    RustingTrainsHandler
} from '../trains/rustTrains.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import {
    EarningsFields,
    type EarningsDetails,
    type EarningsRules
} from '../earnings/earningsDistribution.js'
import {
    DistributeEarnings,
    HydratedDistributeEarnings,
    isDistributeEarnings
} from '../earnings/distributeEarnings.js'
import { DistributingEarningsHandler } from '../earnings/distributingEarningsHandler.js'
import {
    StartOperatingRound,
    HydratedStartOperatingRound,
    isStartOperatingRound,
    privateIncomePayments
} from '../operating/startOperatingRound.js'
import {
    FinishOperatingTurn,
    HydratedFinishOperatingTurn,
    isFinishOperatingTurn
} from '../operating/finishOperatingTurn.js'
import {
    StartStockRound,
    HydratedStartStockRound,
    isStartStockRound
} from '../stock/startStockRound.js'
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
import { AutomaticStockTurnHandler } from '../stock/automaticStockTurnHandler.js'
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
import { SellShares, HydratedSellShares, isSellShares } from '../stock/sellShares.js'
import {
    FinishStockTurn,
    HydratedFinishStockTurn,
    isFinishStockTurn
} from '../stock/finishStockTurn.js'
import { StockMarket, validateStockMarket } from '../stock/stockMarket.js'
import type { StockRules } from '../stock/stockRules.js'
import { StockRound, createStockRound } from '../stock/stockRound.js'
import {
    FinanceFields,
    validateFinances,
    sameOwner,
    type FinancialState
} from '../finance/finance.js'

const ExampleFields = Type.Object({
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

const PositionValidator = Compile(FinanceExamplePosition)
const ExampleColors = [Color.Blue, Color.Red, Color.Green, Color.Yellow, Color.Purple, Color.Orange]
type CreateFinances = (
    players: readonly PlayerState[],
    position: FinanceExamplePosition,
    prng: Prng
) => CompanyState & MapStateData & TrainState
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(
        private readonly options: Pick<
            FinanceExampleOptions,
            | 'createFinances'
            | 'prepareEndingExample'
            | 'offerAuctionRules'
            | 'auctionRules'
            | 'defaultPosition'
            | 'createMarket'
            | 'map'
            | 'tileSet'
            | 'operatingRules'
            | 'stationRules'
            | 'trainRules'
            | 'privateRules'
            | 'stockRules'
        >
    ) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedFinanceExampleState {
        const requestedPosition =
            game.config?.examplePosition ?? this.options.defaultPosition ?? 'trading'
        const position = requestedPosition === 'ending' ? 'trains' : requestedPosition
        assert(PositionValidator.Check(position), 'Unknown finance example position')
        assert(
            position === 'opening'
                ? (this.options.auctionRules || this.options.offerAuctionRules) &&
                      game.players.length >= 2 &&
                      game.players.length <= 6
                : game.players.length === 3 || game.players.length === 4,
            'Unsupported player count or opening'
        )
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: ExampleColors[index]
        }))
        const initialized = new HydratedFinanceExampleState(
            {
                ...state,
                players,
                activePlayerIds: [players[0].playerId],
                example: 'finances',
                phaseEvents: [],
                usedPrivatePowerIds: [],
                machineState: 'StockRound',
                stockRound: createStockRound(position === 'opening' ? 1 : 2),
                stockMarket: this.options.createMarket(position),
                turnManager: new HydratedTurnManager({
                    series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                    turnOrder: players.map((player) => player.playerId),
                    turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
                }),
                ...this.options.createFinances(players, position, new Prng(state.prng))
            },
            this.options.map,
            this.options.tileSet,
            this.options.trainRules.depot
        )
        if (position === 'opening' && initialized.offerAuction) {
            const playerId = initialized.offerAuction.auctioneerId
            initialized.turnManager.newFirstPlayer(playerId)
            initialized.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
            initialized.activePlayerIds = [playerId]
            initialized.machineState = 'OfferingLot'
        } else if (position === 'opening') {
            assert(this.options.auctionRules, 'Opening auction requires its rules')
            const order = initialized.turnManager.turnOrder
            const first = initialized.getPublicPrng().randInt(order.length)
            initialized.turnManager.newFirstPlayer(order[first])
            initialized.turnManager.series = [{ type: 'turn', playerId: order[0], start: 0 }]
            initialized.activePlayerIds = [order[0]]
            initialized.openingAuction = {
                remainingLotIds: this.options.auctionRules.lots(initialized).map((lot) => lot.id),
                reservations: [],
                nextPlayerId: order[0],
                passedPlayerIds: [],
                discount: 0,
                awards: [],
                completed: false
            }
            initialized.machineState = 'WaterfallAuction'
        }
        applyPrivateEffects(
            initialized,
            this.options.privateRules.phaseEffects(initialized),
            this.options.stockRules
        )
        if (
            position === 'construction' ||
            position === 'stations' ||
            position === 'trains' ||
            position === 'routes' ||
            position === 'operations' ||
            position === 'phases' ||
            position === 'diesel' ||
            position === 'private-events' ||
            position === 'transfers' ||
            position === 'powers' ||
            position === 'funding' ||
            position === 'bankruptcy'
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
                companyOrder,
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
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
            if (
                position === 'trains' ||
                position === 'phases' ||
                position === 'diesel' ||
                position === 'private-events' ||
                position === 'transfers' ||
                position === 'funding' ||
                position === 'bankruptcy'
            ) {
                delete initialized.trackStep
                initialized.trainPurchaseStep = { companyId, purchasedTrainIds: [] }
                initialized.machineState = 'BuyingTrains'
            }
            if (position === 'routes') {
                delete initialized.trackStep
                initialized.routeStep = { companyId }
                initialized.machineState = 'RunningTrains'
            }
            if (position === 'operations') {
                settleCashPayments(initialized, privateIncomePayments(initialized))
            }
            initialized.activePlayerIds = [owner.playerId]
            initialized.turnManager.series = [{ type: 'turn', playerId: owner.playerId, start: 0 }]
        }
        if (requestedPosition === 'ending') {
            this.options.prepareEndingExample(initialized)
            applyPrivateEffects(
                initialized,
                this.options.privateRules.phaseEffects(initialized),
                this.options.stockRules
            )
        }
        return initialized
    }
}
export interface FinanceExampleOptions {
    endingRules: EndingRules
    prepareEndingExample: (state: HydratedFinanceExampleState) => void
    stockRoundHandler?: MachineStateHandler<HydratedAction, HydratedFinanceExampleState>
    offerAuctionRules?: OfferPileAuctionRules
    auctionRules?: WaterfallAuctionRules
    defaultPosition?: FinanceExamplePosition
    trainFundingRules: TrainFundingRules
    createFinances: CreateFinances
    stockRules: StockRules
    createMarket: (position: FinanceExamplePosition) => StockMarket
    companyRules: CompanyRules
    operatingRules: OperatingRules
    map: RailwayMap
    tileSet: TileSet
    stationRules: StationRules
    earningsRules: EarningsRules
    routeRules: RouteRules
    trainRules: TrainRules
    phaseRules: PhaseRules
    privateRules: PrivateRules
    transferRules: TransferRules
    privatePowerRules: PrivatePowerRules
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
                if (isScheduleGameEnd(action))
                    return new HydratedScheduleGameEnd(action, options.endingRules)
                if (isEndGame(action)) return new HydratedEndGame(action, options.endingRules)
                if (isContinueOperatingRound(action))
                    return new HydratedContinueOperatingRound(action)
                if (isBuyPrivateTrain(action))
                    return new HydratedBuyPrivateTrain(
                        action,
                        options.privatePowerRules,
                        options.trainRules
                    )
                if (isDeclinePrivateTile(action)) return new HydratedDeclinePrivateTile(action)
                if (isLayPrivateTile(action))
                    return new HydratedLayPrivateTile(
                        action,
                        options.privatePowerRules,
                        options.trackRules
                    )
                if (isRespondToTrackConsent(action))
                    return new HydratedRespondToTrackConsent(action, options.trackRules)
                if (isRequestTrackConsent(action))
                    return new HydratedRequestTrackConsent(action, options.trackRules)
                if (isRespondToPurchaseOffer(action))
                    return new HydratedRespondToPurchaseOffer(
                        action,
                        options.transferRules,
                        options.trainRules
                    )
                if (isOfferPurchase(action))
                    return new HydratedOfferPurchase(
                        action,
                        options.transferRules,
                        options.trainRules
                    )
                if (isExchangePrivate(action))
                    return new HydratedExchangePrivate(action, options.privateRules, rules)
                if (isAdvancePhase(action))
                    return new HydratedAdvancePhase(
                        action,
                        options.phaseRules,
                        options.trainRules,
                        options.privateRules,
                        rules
                    )
                if (isDiscardTrain(action))
                    return new HydratedDiscardTrain(action, options.trainRules, options.phaseRules)
                if (isRustTrains(action)) return new HydratedRustTrains(action)
                if (isDistributeEarnings(action))
                    return new HydratedDistributeEarnings(
                        action,
                        options.earningsRules,
                        options.privateRules,
                        rules
                    )
                if (isStartOperatingRound(action))
                    return new HydratedStartOperatingRound(action, operatingRules)
                if (isFinishOperatingTurn(action))
                    return new HydratedFinishOperatingTurn(action, options.trainRules)
                if (isStartStockRound(action)) return new HydratedStartStockRound(action)
                if (isReserveBid(action)) {
                    const auctionRules = options.auctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedReserveBid(action, auctionRules)
                }
                if (isRaiseAuctionBid(action)) {
                    const auctionRules = options.auctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedRaiseAuctionBid(action, auctionRules)
                }
                if (isBuyAuctionLot(action)) {
                    const auctionRules = options.auctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedBuyAuctionLot(action, auctionRules)
                }
                if (isOfferAuctionLot(action)) {
                    const auctionRules = options.offerAuctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedOfferAuctionLot(action, auctionRules)
                }
                if (isBidOnAuctionLot(action)) {
                    const auctionRules = options.offerAuctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedBidOnAuctionLot(action, auctionRules)
                }
                if (isPassAuction(action)) {
                    const auctionRules = options.offerAuctionRules ?? options.auctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedPassAuction(action, auctionRules)
                }
                if (isResolveAuction(action)) {
                    const auctionRules = options.offerAuctionRules ?? options.auctionRules
                    assert(auctionRules, 'Auction actions require auction rules')
                    return new HydratedResolveAuction(action, auctionRules)
                }
                if (isFundTrain(action))
                    return new HydratedFundTrain(
                        action,
                        options.trainFundingRules,
                        rules,
                        options.trainRules
                    )
                if (isIssueTreasuryShares(action))
                    return new HydratedIssueTreasuryShares(
                        action,
                        options.trainFundingRules,
                        rules,
                        options.trainRules
                    )
                if (isSellFundingShares(action))
                    return new HydratedSellFundingShares(
                        action,
                        options.trainFundingRules,
                        rules,
                        options.trainRules
                    )
                if (isContributeTrainFunds(action))
                    return new HydratedContributeTrainFunds(
                        action,
                        options.trainFundingRules,
                        rules,
                        options.trainRules
                    )
                if (isDeclareBankruptcy(action))
                    return new HydratedDeclareBankruptcy(
                        action,
                        options.trainFundingRules,
                        rules,
                        options.trainRules
                    )
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
            ScheduleGameEnd,
            EndGame,
            ...(options.offerAuctionRules
                ? { OfferAuctionLot, BidOnAuctionLot, PassAuction, ResolveAuction }
                : {}),
            ...(options.auctionRules
                ? { ReserveBid, RaiseAuctionBid, BuyAuctionLot, PassAuction, ResolveAuction }
                : {}),
            FundTrain,
            IssueTreasuryShares,
            SellFundingShares,
            ContributeTrainFunds,
            DeclareBankruptcy,
            ContinueOperatingRound,
            BuyPrivateTrain,
            DeclinePrivateTile,
            LayPrivateTile,
            RespondToTrackConsent,
            RequestTrackConsent,
            RespondToPurchaseOffer,
            OfferPurchase,
            ExchangePrivate,
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
            RunTrains,
            DistributeEarnings,
            StartOperatingRound,
            FinishOperatingTurn,
            StartStockRound,
            AdvancePhase,
            DiscardTrain,
            RustTrains
        },
        stateHandlers: Object.fromEntries(
            Object.entries({
                ...(options.offerAuctionRules
                    ? {
                          OfferingLot: new OfferAuctionHandler<HydratedFinanceExampleState>(
                              options.offerAuctionRules
                          ),
                          OfferBidding: new OfferAuctionHandler<HydratedFinanceExampleState>(
                              options.offerAuctionRules
                          )
                      }
                    : {}),
                ...(options.auctionRules
                    ? {
                          WaterfallAuction:
                              new WaterfallAuctionHandler<HydratedFinanceExampleState>(
                                  options.auctionRules
                              ),
                          AuctionBidding: new WaterfallAuctionHandler<HydratedFinanceExampleState>(
                              options.auctionRules
                          )
                      }
                    : {}),
                FundingTrain: new FundingTrainHandler<HydratedFinanceExampleState>(
                    options.trainFundingRules,
                    rules,
                    options.trainRules
                ),
                GameOver: new TerminalStateHandler(),
                Bankrupt: new BankruptHandler<HydratedFinanceExampleState>(),
                AdvancingPhase: new AdvancingPhaseHandler(),
                DiscardingTrains: new DiscardingTrainsHandler(options.trainRules),
                RustingTrains: new RustingTrainsHandler('DistributingEarnings'),
                StockRound: new AutomaticStockTurnHandler(new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    options.stockRoundHandler ??
                        new StockRoundHandler(rules, 'StartingOperatingSet', companyRules),
                    options.privateRules,
                    rules,
                    companyRules
                )),
                StartingOperatingSet: new StartOperatingSetHandler('OperatingSet'),
                OperatingSet: new BetweenCompaniesHandler<HydratedFinanceExampleState>(
                    new StartOperatingTurnHandler(options.stationRules),
                    options.privatePowerRules,
                    options.trackRules,
                    options.stationRules
                ),
                LayingTrack: new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    new LayingTrackHandler(options.trackRules, 'PlacingStation'),
                    options.privateRules,
                    rules,
                    companyRules
                ),
                PlacingStation: new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    new PlacingStationHandler(options.stationRules, 'RunningTrains'),
                    options.privateRules,
                    rules,
                    companyRules
                ),
                StationsComplete: new TerminalStateHandler(),
                RunningTrains: new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    new RunningTrainsHandler(options.routeRules, 'DistributingEarnings'),
                    options.privateRules,
                    rules,
                    companyRules
                ),
                DistributingEarnings: new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    new DistributingEarningsHandler(options.earningsRules),
                    options.privateRules,
                    rules,
                    companyRules
                ),
                BuyingTrains: new PrivateExchangeHandler<HydratedFinanceExampleState>(
                    new BuyingTrainsHandler(options.trainRules, options.trainFundingRules, rules),
                    options.privateRules,
                    rules,
                    companyRules
                )
            }).map(([name, handler]) => [
                name,
                name === 'GameOver'
                    ? handler
                    : new GameEndingHandler<HydratedFinanceExampleState>(
                          [
                              'StockRound',
                              'LayingTrack',
                              'PlacingStation',
                              'RunningTrains',
                              'DistributingEarnings',
                              'BuyingTrains'
                          ].includes(name)
                              ? new CompanyDecisionsHandler<HydratedFinanceExampleState>(
                                    handler,
                                    options.transferRules,
                                    options.privatePowerRules,
                                    options.trainRules,
                                    companyRules,
                                    options.trackRules
                                )
                              : handler,
                          options.endingRules
                      )
            ] as const).map(([name, handler]) => [
                name,
                name === 'LayingTrack' ? new AutomaticTrackCompletionHandler<HydratedFinanceExampleState>(handler)
                    : name === 'BuyingTrains' ? new AutomaticTrainCompletionHandler<HydratedFinanceExampleState>(handler) : handler
            ])
        )
    }
}

export function requireFinanceExampleState(state: HydratedGameState): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
