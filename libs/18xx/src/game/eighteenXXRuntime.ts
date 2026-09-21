import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import { AutomaticTrackCompletionHandler } from '../construction/automaticTrackCompletionHandler.js'
import { AutomaticTrainCompletionHandler } from '../trains/automaticTrainCompletionHandler.js'
import { GameEndingHandler } from '../ending/gameEndingHandler.js'
import { OfferAuctionHandler } from '../auctions/offerAuctionHandler.js'
import { WaterfallAuctionHandler } from '../auctions/waterfallAuctionHandler.js'
import { FundingTrainHandler } from '../funding/fundingTrainHandler.js'
import { BankruptHandler } from '../funding/bankruptHandler.js'
import { BetweenCompaniesHandler } from '../privates/betweenCompaniesHandler.js'
import { CompanyDecisionsHandler } from '../privates/companyDecisionsHandler.js'
import { PrivateExchangeHandler } from '../privates/privateExchangeHandler.js'
import { AdvancingPhaseHandler } from '../phases/advancePhase.js'
import { DiscardingTrainsHandler } from '../trains/discardTrain.js'
import { RustingTrainsHandler } from '../trains/rustTrains.js'
import { DistributingEarningsHandler } from '../earnings/distributingEarningsHandler.js'
import { RunningTrainsHandler } from '../routes/runningTrainsHandler.js'
import { BuyingTrainsHandler } from '../trains/buyingTrainsHandler.js'
import { PlacingStationHandler } from '../stations/placingStationHandler.js'
import { LayingTrackHandler } from '../construction/layingTrackHandler.js'
import { StartOperatingTurnHandler } from '../operating/startOperatingTurn.js'
import { StartOperatingSetHandler } from '../operating/startOperatingSetHandler.js'
import { TerminalStateHandler, type GameRuntime } from '@tabletop/common'
import { AutomaticStockTurnHandler } from '../stock/automaticStockTurnHandler.js'
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
import { EighteenXXState, HydratedEighteenXXState } from './eighteenXXState.js'
import { ActionRegistry } from '../actions/actionDefinition.js'
import { endingActions } from '../ending/endingActions.js'
import { auctionActions } from '../auctions/auctionActions.js'
import { fundingActions } from '../funding/fundingActions.js'
import { privateActions } from '../privates/privateActions.js'
import { trackActions } from '../construction/trackActions.js'
import { transferActions } from '../transfers/transferActions.js'
import { phaseActions } from '../phases/phaseActions.js'
import { operatingActions } from '../operating/operatingActions.js'
import { stockActions } from '../stock/stockActions.js'
import { stationActions } from '../stations/stationActions.js'
import { trainActions } from '../trains/trainActions.js'
import { routeActions } from '../routes/routeActions.js'
import { earningsActions } from '../earnings/earningsActions.js'
import { companyActions } from '../company/companyActions.js'
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
    const actions = new ActionRegistry([
        ...endingActions(options.endingRules),
        ...auctionActions(options.offerAuctionRules, options.auctionRules),
        ...fundingActions(options.trainFundingRules, rules, options.trainRules),
        ...privateActions(options),
        ...trackActions(options.trackRules),
        ...transferActions(options.transferRules, options.trainRules),
        ...phaseActions(options),
        ...operatingActions(operatingRules, options.trainRules, options.endingRules),
        ...stockActions(rules),
        ...companyActions(companyRules, rules),
        ...stationActions(options.stationRules),
        ...routeActions(options.routeRules),
        ...earningsActions(options.earningsRules, options.privateRules, rules),
        ...trainActions(options.trainRules, options.phaseRules)
    ])
    return {
        initializer: new EighteenXXInitializer(options),
        hydrator: {
            hydrateState: (state) =>
                new HydratedEighteenXXState(state, map, tileSet, options.trainRules.depot),
            hydrateAction: (action) => {
                const hydrated = actions.hydrate(action)
                if (!hydrated) throw new Error(`Unknown 18xx action: ${action.type}`)
                return hydrated
            }
        },
        canonicalStateValidator: handledStateValidator(Object.keys(stateHandlers)),
        playerColors: EighteenXXInitializer.playerColors,
        apiActions: actions.schemas,
        stateHandlers
    }
}

