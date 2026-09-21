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
import {
    TerminalStateHandler,
    type GameRuntime,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
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
    type Handler = MachineStateHandler<HydratedAction, HydratedEighteenXXState>
    const endsGame = (handler: Handler): Handler =>
        new GameEndingHandler<HydratedEighteenXXState>(handler, options.endingRules)
    const allowsExchange = (handler: Handler): Handler =>
        new PrivateExchangeHandler<HydratedEighteenXXState>(
            handler,
            options.privateRules,
            rules,
            companyRules
        )
    const allowsCompanyDecisions = (handler: Handler): Handler =>
        new CompanyDecisionsHandler<HydratedEighteenXXState>(
            handler,
            options.transferRules,
            options.privatePowerRules,
            options.trainRules,
            companyRules,
            options.trackRules
        )
    const operatingStep = (handler: Handler): Handler =>
        endsGame(allowsCompanyDecisions(allowsExchange(handler)))
    const stateHandlers: Record<string, Handler> = {
        ...(options.offerAuctionRules
            ? {
                  OfferingLot: endsGame(new OfferAuctionHandler(options.offerAuctionRules)),
                  OfferBidding: endsGame(new OfferAuctionHandler(options.offerAuctionRules))
              }
            : {}),
        ...(options.auctionRules
            ? {
                  WaterfallAuction: endsGame(new WaterfallAuctionHandler(options.auctionRules)),
                  AuctionBidding: endsGame(new WaterfallAuctionHandler(options.auctionRules))
              }
            : {}),
        FundingTrain: endsGame(
            new FundingTrainHandler(options.trainFundingRules, rules, options.trainRules)
        ),
        GameOver: new TerminalStateHandler(),
        Bankrupt: endsGame(new BankruptHandler()),
        AdvancingPhase: endsGame(new AdvancingPhaseHandler()),
        DiscardingTrains: endsGame(new DiscardingTrainsHandler(options.trainRules)),
        RustingTrains: endsGame(new RustingTrainsHandler('DistributingEarnings')),
        StockRound: endsGame(
            allowsCompanyDecisions(
                new AutomaticStockTurnHandler(
                    allowsExchange(
                        options.stockRoundHandler ??
                            new StockRoundHandler(rules, 'StartingOperatingSet', companyRules)
                    )
                )
            )
        ),
        StartingOperatingSet: endsGame(new StartOperatingSetHandler('OperatingSet')),
        OperatingSet: endsGame(
            new BetweenCompaniesHandler(
                new StartOperatingTurnHandler(options.stationRules),
                options.privatePowerRules,
                options.trackRules,
                options.stationRules
            )
        ),
        LayingTrack: new AutomaticTrackCompletionHandler(
            operatingStep(new LayingTrackHandler(options.trackRules, 'PlacingStation'))
        ),
        PlacingStation: operatingStep(
            new PlacingStationHandler(options.stationRules, 'RunningTrains')
        ),
        StationsComplete: endsGame(new TerminalStateHandler()),
        RunningTrains: operatingStep(
            new RunningTrainsHandler(options.routeRules, 'DistributingEarnings')
        ),
        DistributingEarnings: operatingStep(new DistributingEarningsHandler(options.earningsRules)),
        BuyingTrains: new AutomaticTrainCompletionHandler(
            operatingStep(
                new BuyingTrainsHandler(options.trainRules, options.trainFundingRules, rules)
            )
        )
    }
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
        ...trainActions(options.trainRules, options.phaseRules),
        ...(options.titleActions ?? [])
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

