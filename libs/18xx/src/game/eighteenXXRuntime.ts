import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import { AutomaticTrackCompletionHandler } from '../construction/automaticTrackCompletionHandler.js'
import { AutomaticTrainCompletionHandler } from '../trains/automaticTrainCompletionHandler.js'
import {
    ScheduleGameEnd,
    HydratedScheduleGameEnd,
    isScheduleGameEnd
} from '../ending/scheduleGameEnd.js'
import { EndGame, HydratedEndGame, isEndGame } from '../ending/endGame.js'
import { GameEndingHandler } from '../ending/gameEndingHandler.js'
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
import {
    DistributeEarnings,
    HydratedDistributeEarnings,
    isDistributeEarnings
} from '../earnings/distributeEarnings.js'
import { DistributingEarningsHandler } from '../earnings/distributingEarningsHandler.js'
import {
    StartOperatingRound,
    HydratedStartOperatingRound,
    isStartOperatingRound
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
import { RunTrains, HydratedRunTrains, isRunTrains } from '../routes/runTrains.js'
import { RunningTrainsHandler } from '../routes/runningTrainsHandler.js'
import { BuyTrain, HydratedBuyTrain, isBuyTrain } from '../trains/buyTrain.js'
import { BuyingTrainsHandler } from '../trains/buyingTrainsHandler.js'
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
import { LayTile, HydratedLayTile, isLayTile } from '../construction/layTile.js'
import { FinishTrack, HydratedFinishTrack, isFinishTrack } from '../construction/finishTrack.js'
import { LayingTrackHandler } from '../construction/layingTrackHandler.js'
import {
    StartOperatingTurn,
    HydratedStartOperatingTurn,
    isStartOperatingTurn,
    StartOperatingTurnHandler
} from '../operating/startOperatingTurn.js'
import {
    CompleteStockRound,
    HydratedCompleteStockRound,
    isCompleteStockRound
} from '../stock/completeStockRound.js'
import {
    StartOperatingSet,
    HydratedStartOperatingSet,
    isStartOperatingSet
} from '../operating/startOperatingSet.js'
import { StartOperatingSetHandler } from '../operating/startOperatingSetHandler.js'
import { StartCompany, HydratedStartCompany, isStartCompany } from '../company/startCompany.js'
import { FloatCompany, HydratedFloatCompany, isFloatCompany } from '../company/floatCompany.js'
import { TerminalStateHandler, assert, type GameRuntime } from '@tabletop/common'
import { BuyShares, HydratedBuyShares, isBuyShares } from '../stock/buyShares.js'
import { AutomaticStockTurnHandler } from '../stock/automaticStockTurnHandler.js'
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
import { SellShares, HydratedSellShares, isSellShares } from '../stock/sellShares.js'
import {
    FinishStockTurn,
    HydratedFinishStockTurn,
    isFinishStockTurn
} from '../stock/finishStockTurn.js'

import { EighteenXXState, HydratedEighteenXXState } from './eighteenXXState.js'
import { EighteenXXInitializer } from './eighteenXXInitializer.js'
import type { EighteenXXTitleRules } from './eighteenXXTitleRules.js'
function handledStateValidator(machineStates: readonly string[]): Pick<Validator, 'Check'> {
    return Compile(
        Type.Object(
            {
                ...EighteenXXState.properties,
                machineState: Type.Union(machineStates.map((name) => Type.Literal(name)))
            },
            { additionalProperties: false }
        )
    )
}
export function createEighteenXXRuntime(
    options: EighteenXXTitleRules
): GameRuntime<EighteenXXState, HydratedEighteenXXState> {
    const { stockRules: rules, companyRules, operatingRules, map, tileSet } = options
    const stateHandlers = Object.fromEntries(
        Object.entries({
            ...(options.offerAuctionRules
                ? {
                      OfferingLot: new OfferAuctionHandler<HydratedEighteenXXState>(
                          options.offerAuctionRules
                      ),
                      OfferBidding: new OfferAuctionHandler<HydratedEighteenXXState>(
                          options.offerAuctionRules
                      )
                  }
                : {}),
            ...(options.auctionRules
                ? {
                      WaterfallAuction:
                          new WaterfallAuctionHandler<HydratedEighteenXXState>(
                              options.auctionRules
                          ),
                      AuctionBidding: new WaterfallAuctionHandler<HydratedEighteenXXState>(
                          options.auctionRules
                      )
                  }
                : {}),
            FundingTrain: new FundingTrainHandler<HydratedEighteenXXState>(
                options.trainFundingRules,
                rules,
                options.trainRules
            ),
            GameOver: new TerminalStateHandler(),
            Bankrupt: new BankruptHandler<HydratedEighteenXXState>(),
            AdvancingPhase: new AdvancingPhaseHandler(),
            DiscardingTrains: new DiscardingTrainsHandler(options.trainRules),
            RustingTrains: new RustingTrainsHandler('DistributingEarnings'),
            StockRound: new AutomaticStockTurnHandler(
                new PrivateExchangeHandler<HydratedEighteenXXState>(
                    options.stockRoundHandler ??
                        new StockRoundHandler(rules, 'StartingOperatingSet', companyRules),
                    options.privateRules,
                    rules,
                    companyRules
                )
            ),
            StartingOperatingSet: new StartOperatingSetHandler('OperatingSet'),
            OperatingSet: new BetweenCompaniesHandler<HydratedEighteenXXState>(
                new StartOperatingTurnHandler(options.stationRules),
                options.privatePowerRules,
                options.trackRules,
                options.stationRules
            ),
            LayingTrack: new PrivateExchangeHandler<HydratedEighteenXXState>(
                new LayingTrackHandler(options.trackRules, 'PlacingStation'),
                options.privateRules,
                rules,
                companyRules
            ),
            PlacingStation: new PrivateExchangeHandler<HydratedEighteenXXState>(
                new PlacingStationHandler(options.stationRules, 'RunningTrains'),
                options.privateRules,
                rules,
                companyRules
            ),
            StationsComplete: new TerminalStateHandler(),
            RunningTrains: new PrivateExchangeHandler<HydratedEighteenXXState>(
                new RunningTrainsHandler(options.routeRules, 'DistributingEarnings'),
                options.privateRules,
                rules,
                companyRules
            ),
            DistributingEarnings: new PrivateExchangeHandler<HydratedEighteenXXState>(
                new DistributingEarningsHandler(options.earningsRules),
                options.privateRules,
                rules,
                companyRules
            ),
            BuyingTrains: new PrivateExchangeHandler<HydratedEighteenXXState>(
                new BuyingTrainsHandler(options.trainRules, options.trainFundingRules, rules),
                options.privateRules,
                rules,
                companyRules
            )
        })
            .map(
                ([name, handler]) =>
                    [
                        name,
                        name === 'GameOver'
                            ? handler
                            : new GameEndingHandler<HydratedEighteenXXState>(
                                  [
                                      'StockRound',
                                      'LayingTrack',
                                      'PlacingStation',
                                      'RunningTrains',
                                      'DistributingEarnings',
                                      'BuyingTrains'
                                  ].includes(name)
                                      ? new CompanyDecisionsHandler<HydratedEighteenXXState>(
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
                    ] as const
            )
            .map(([name, handler]) => [
                name,
                name === 'LayingTrack'
                    ? new AutomaticTrackCompletionHandler<HydratedEighteenXXState>(handler)
                    : name === 'BuyingTrains'
                      ? new AutomaticTrainCompletionHandler<HydratedEighteenXXState>(
                            handler
                        )
                      : handler
            ])
    )
    return {
        initializer: new EighteenXXInitializer(options),
        hydrator: {
            hydrateState: (state) =>
                new HydratedEighteenXXState(state, map, tileSet, options.trainRules.depot),
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
                    return new HydratedStartOperatingRound(action, operatingRules, options.endingRules)
                if (isFinishOperatingTurn(action))
                    return new HydratedFinishOperatingTurn(action, options.trainRules, options.endingRules)
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
                throw new Error(`Unknown 18xx action: ${action.type}`)
            }
        },
        canonicalStateValidator: handledStateValidator(Object.keys(stateHandlers)),
        playerColors: EighteenXXInitializer.playerColors,
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
        stateHandlers
    }
}

