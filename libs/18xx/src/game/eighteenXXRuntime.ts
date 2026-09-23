import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import { AutomaticTrackCompletionHandler } from '../construction/automaticTrackCompletionHandler.js'
import { AutomaticTrainCompletionHandler } from '../trains/automaticTrainCompletionHandler.js'
import { GameEndingHandler } from '../ending/gameEndingHandler.js'
import { FinalWealthScoring } from '../ending/finalScores.js'
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
import { TerminalStateHandler, assert, type GameRuntime } from '@tabletop/common'
import { AutomaticStockTurnHandler } from '../stock/automaticStockTurnHandler.js'
import { StockInstructionHandler } from '../stock/stockInstructionHandler.js'
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
import {
    EighteenXXState,
    FamilyStateDefinition,
    HydratedEighteenXXState,
    inKnownPhase,
    type EighteenXXMachineState
} from './eighteenXXState.js'
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
import {
    BetweenCompaniesState,
    OperatingStepStates,
    stateAfterOperatingStep
} from '../operating/operatingSteps.js'
import { EighteenXXInitializer } from './eighteenXXInitializer.js'
import { titleComponents } from './titleComponents.js'
import type { EighteenXXStateHandler, EighteenXXTitleRules } from './eighteenXXTitleRules.js'
function handledStateValidator(
    schema: Type.TObject,
    machineStates: readonly string[]
): Pick<Validator, 'Check'> {
    return Compile(
        Type.Object(
            {
                ...schema.properties,
                machineState: Type.Union(machineStates.map((name) => Type.Literal(name)))
            },
            { additionalProperties: false }
        )
    )
}
export function createEighteenXXRuntime(
    options: EighteenXXTitleRules
): GameRuntime<EighteenXXState, HydratedEighteenXXState> {
    const { stockRules: rules, companyRules, operatingRules } = options
    const { map, tileSet, depot } = titleComponents(options)
    type Handler = EighteenXXStateHandler
    const stateDefinition = options.state ?? FamilyStateDefinition
    const decides = (machineState: EighteenXXMachineState, family: Handler): Handler =>
        options.decisionHandlers?.[machineState]?.(family) ?? family
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
    const after = stateAfterOperatingStep
    const operatingStep = (handler: Handler): Handler =>
        endsGame(allowsCompanyDecisions(allowsExchange(handler)))
    const familyStateHandlers: Record<string, Handler> = {
        ...(options.offerAuctionRules
            ? {
                  OfferingLot: endsGame(
                      decides('OfferingLot', new OfferAuctionHandler(options.offerAuctionRules))
                  ),
                  OfferBidding: endsGame(
                      decides('OfferBidding', new OfferAuctionHandler(options.offerAuctionRules))
                  )
              }
            : {}),
        ...(options.auctionRules
            ? {
                  WaterfallAuction: endsGame(
                      decides('WaterfallAuction', new WaterfallAuctionHandler(options.auctionRules))
                  ),
                  AuctionBidding: endsGame(
                      decides('AuctionBidding', new WaterfallAuctionHandler(options.auctionRules))
                  )
              }
            : {}),
        FundingTrain: endsGame(
            decides(
                'FundingTrain',
                new FundingTrainHandler(options.trainFundingRules, rules, options.trainRules)
            )
        ),
        GameOver: new TerminalStateHandler(),
        Bankrupt: endsGame(decides('Bankrupt', new BankruptHandler())),
        AdvancingPhase: endsGame(decides('AdvancingPhase', new AdvancingPhaseHandler())),
        DiscardingTrains: endsGame(
            decides('DiscardingTrains', new DiscardingTrainsHandler(options.trainRules))
        ),
        RustingTrains: endsGame(
            decides('RustingTrains', new RustingTrainsHandler(after('RunningTrains')))
        ),
        StockRound: endsGame(
            new StockInstructionHandler(
                allowsCompanyDecisions(
                    new AutomaticStockTurnHandler(
                        allowsExchange(
                            decides(
                                'StockRound',
                                new StockRoundHandler(rules, 'StartingOperatingSet', companyRules)
                            )
                        )
                    )
                ),
                rules
            )
        ),
        StartingOperatingSet: endsGame(
            decides('StartingOperatingSet', new StartOperatingSetHandler(BetweenCompaniesState))
        ),
        OperatingSet: endsGame(
            new BetweenCompaniesHandler(
                decides(
                    'OperatingSet',
                    new StartOperatingTurnHandler(options.stationRules, OperatingStepStates[0])
                ),
                options.privatePowerRules,
                options.trackRules,
                options.stationRules
            )
        ),
        LayingTrack: new AutomaticTrackCompletionHandler(
            operatingStep(
                decides(
                    'LayingTrack',
                    new LayingTrackHandler(options.trackRules, after('LayingTrack'))
                )
            )
        ),
        PlacingStation: operatingStep(
            decides(
                'PlacingStation',
                new PlacingStationHandler(options.stationRules, after('PlacingStation'))
            )
        ),
        StationsComplete: endsGame(new TerminalStateHandler()),
        RunningTrains: operatingStep(
            decides(
                'RunningTrains',
                new RunningTrainsHandler(options.routeRules, after('RunningTrains'))
            )
        ),
        DistributingEarnings: operatingStep(
            decides(
                'DistributingEarnings',
                new DistributingEarningsHandler(
                    options.earningsRules,
                    after('DistributingEarnings')
                )
            )
        ),
        BuyingTrains: new AutomaticTrainCompletionHandler(
            operatingStep(
                decides(
                    'BuyingTrains',
                    new BuyingTrainsHandler(
                        options.trainRules,
                        options.trainFundingRules,
                        rules,
                        after('BuyingTrains')
                    )
                )
            )
        )
    }
    for (const machineState of Object.keys(options.titleStateHandlers ?? {}))
        assert(
            !(machineState in familyStateHandlers),
            `${machineState} already has a family handler; wrap its decisions instead`
        )
    const stateHandlers: Record<string, Handler> = {
        ...familyStateHandlers,
        ...options.titleStateHandlers
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
                inKnownPhase(stateDefinition.hydrate(state, map, tileSet, depot), options.phases),
            hydrateAction: (action) => {
                const hydrated = actions.hydrate(action)
                if (!hydrated) throw new Error(`Unknown 18xx action: ${action.type}`)
                return hydrated
            }
        },
        canonicalStateValidator: handledStateValidator(
            stateDefinition.schema,
            Object.keys(stateHandlers)
        ),
        playerColors: EighteenXXInitializer.playerColors,
        randomnessVersion: 1,
        scoring: FinalWealthScoring,
        apiActions: actions.schemas,
        stateHandlers
    }
}
