import { TerminalStateHandler, assert, type GameRuntime } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionRegistry } from '../actions/actionDefinition.js'
import { auctionActions } from '../auctions/auctionActions.js'
import { OfferAuctionHandler } from '../auctions/offerAuctionHandler.js'
import { SelectionAuctionHandler } from '../auctions/selectionAuctionHandler.js'
import { WaterfallAuctionHandler } from '../auctions/waterfallAuctionHandler.js'
import { companyActions } from '../company/companyActions.js'
import { PendingParHandler } from '../company/pendingPar.js'
import { AutomaticTrackCompletionHandler } from '../construction/automaticTrackCompletionHandler.js'
import { LayingTrackHandler } from '../construction/layingTrackHandler.js'
import { trackActions } from '../construction/trackActions.js'
import { DistributingEarningsHandler } from '../earnings/distributingEarningsHandler.js'
import { earningsActions } from '../earnings/earningsActions.js'
import { endingActions } from '../ending/endingActions.js'
import { FinalWealthScoring } from '../ending/finalScores.js'
import { GameEndingHandler } from '../ending/gameEndingHandler.js'
import { BankruptHandler } from '../funding/bankruptHandler.js'
import { cashCrisisActions } from '../funding/cashCrisisActions.js'
import { fundingActions } from '../funding/fundingActions.js'
import { FundingTrainHandler } from '../funding/fundingTrainHandler.js'
import { RaisingCashHandler } from '../funding/raisingCashHandler.js'
import { loanActions } from '../loans/loanActions.js'
import { LoanTakingHandler } from '../loans/loanTakingHandler.js'
import { RepayingLoansHandler } from '../loans/repayingLoansHandler.js'
import { operatingActions } from '../operating/operatingActions.js'
import {
    BetweenCompaniesState,
    OperatingStepStates,
    stateAfterOperatingStep
} from '../operating/operatingSteps.js'
import { StartOperatingSetHandler } from '../operating/startOperatingSetHandler.js'
import { StartOperatingTurnHandler } from '../operating/startOperatingTurn.js'
import { AdvancingPhaseHandler } from '../phases/advancePhase.js'
import { phaseActions } from '../phases/phaseActions.js'
import { BetweenCompaniesHandler } from '../privates/betweenCompaniesHandler.js'
import { CompanyDecisionsHandler } from '../privates/companyDecisionsHandler.js'
import { privateActions } from '../privates/privateActions.js'
import { PrivateExchangeHandler } from '../privates/privateExchangeHandler.js'
import { PrivatePowerRequestHandler } from '../privates/privatePowerRequestHandler.js'
import { routeActions } from '../routes/routeActions.js'
import { RunningTrainsHandler } from '../routes/runningTrainsHandler.js'
import { HomeStationChoiceHandler } from '../stations/chooseHomeStation.js'
import { PlacingStationHandler } from '../stations/placingStationHandler.js'
import { stationActions } from '../stations/stationActions.js'
import { AutomaticStockTurnHandler } from '../stock/automaticStockTurnHandler.js'
import { stockActions } from '../stock/stockActions.js'
import { StockInstructionHandler } from '../stock/stockInstructionHandler.js'
import { StockRoundHandler } from '../stock/stockRoundHandler.js'
import { AutomaticTrainCompletionHandler } from '../trains/automaticTrainCompletionHandler.js'
import { BuyingTrainsHandler } from '../trains/buyingTrainsHandler.js'
import { DiscardingTrainsHandler } from '../trains/discardTrain.js'
import { RustingTrainsHandler } from '../trains/rustTrains.js'
import { trainActions } from '../trains/trainActions.js'
import { transferActions } from '../transfers/transferActions.js'
import { EighteenXXGameExploration } from './eighteenXXGameExploration.js'
import { EighteenXXInitializer } from './eighteenXXInitializer.js'
import {
    HydratedEighteenXXState,
    inKnownPhase,
    type EighteenXXMachineState,
    type TitleStateSchema
} from './eighteenXXState.js'
import type { EighteenXXStateHandler, EighteenXXTitleRules } from './eighteenXXTitleRules.js'
import { titleComponents } from './titleComponents.js'
function validateStateComposition(
    schema: Type.TObject,
    options: Pick<
        EighteenXXTitleRules,
        | 'offerAuctionRules'
        | 'auctionRules'
        | 'selectionAuctionRules'
        | 'loanRules'
        | 'cashCrisisRules'
        | 'companyRules'
        | 'stockRules'
        | 'privatePowerRules'
    >,
    handlers: Readonly<Record<string, unknown>>
): void {
    const features: readonly (readonly [string, boolean])[] = [
        ['offerAuction', !!options.offerAuctionRules],
        ['openingAuction', !!options.auctionRules],
        ['selectionAuction', !!options.selectionAuctionRules],
        ['pendingPar', !!options.companyRules.parAfterAward],
        ['companyAuction', !!options.stockRules.companyAuction],
        ['stockTurnPurchases', !!options.stockRules.multipleBuys],
        ['loanStep', !!options.loanRules],
        ['interestRate', !!options.loanRules],
        ['cashCrisis', !!options.cashCrisisRules],
        ['bankruptPlayerIds', !!options.cashCrisisRules],
        ['privatePowerWindow', !!options.privatePowerRules.betweenTurnsPrivateIds?.length],
        ['privatePowerRequests', !!options.privatePowerRules.betweenTurnsPrivateIds?.length],
        ['privateStation', !!options.privatePowerRules.stationPrivateIds?.length],
        ['locationMarkers', !!options.privatePowerRules.markerTerms]
    ]
    for (const [field, supported] of features)
        assert(
            field in schema.properties === supported,
            `${field} state and rules must be selected together`
        )
    const machine = schema.properties.machineState
    const states = 'anyOf' in machine && Array.isArray(machine.anyOf) ? machine.anyOf : [machine]
    const declared = new Set<string>()
    for (const state of states) {
        assert(
            Type.IsLiteral(state) && typeof state.const === 'string',
            'Declare literal machine states'
        )
        declared.add(state.const)
        assert(state.const in handlers, `${state.const} has no state handler`)
    }
    for (const name of Object.keys(handlers))
        assert(declared.has(name), `${name} handler requires its declared machine state`)
}
export function createEighteenXXRuntime<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
>(options: EighteenXXTitleRules<Schema, State>): GameRuntime<Type.Static<Schema>, State> {
    const { stockRules: rules, companyRules, operatingRules } = options
    const { map, tileSet, depot } = titleComponents(options)
    type Handler = EighteenXXStateHandler<State>
    const stateDefinition = options.state
    const decides = (machineState: EighteenXXMachineState, family: Handler): Handler =>
        options.decisionHandlers?.[machineState]?.(family) ?? family
    const endsGame = (handler: Handler): Handler =>
        new GameEndingHandler<State>(handler, options.endingRules)
    const allowsExchange = (handler: Handler): Handler =>
        new PrivateExchangeHandler<State>(
            handler,
            options.privateRules,
            rules,
            companyRules,
            options.outOfTurnPrivatePowers === true
        )
    const allowsCompanyDecisions = (handler: Handler): Handler =>
        new CompanyDecisionsHandler<State>(
            handler,
            options.transferRules,
            options.privatePowerRules,
            options.trainRules,
            companyRules,
            options.trackRules,
            options.outOfTurnPrivatePowers === true
        )
    const allowsPrivatePowerRequests = (handler: Handler): Handler =>
        options.privatePowerRules.betweenTurnsPrivateIds?.length
            ? new PrivatePowerRequestHandler<State>(handler, options.privatePowerRules)
            : handler
    const choosesHome = (handler: Handler): Handler =>
        options.stationRules.homeChoice
            ? new HomeStationChoiceHandler(handler, options.stationRules)
            : handler
    const awaitsPar = (handler: Handler): Handler =>
        companyRules.parAfterAward ? new PendingParHandler(handler) : handler
    const { loanRules } = options
    const operatingSteps = loanRules
        ? [...OperatingStepStates, 'RepayingLoans']
        : OperatingStepStates
    const after = (step: string) => stateAfterOperatingStep(step, operatingSteps)
    const allowsLoans = (handler: Handler): Handler =>
        loanRules ? new LoanTakingHandler(handler, loanRules) : handler
    const operatingStep = (handler: Handler): Handler =>
        endsGame(
            allowsPrivatePowerRequests(allowsCompanyDecisions(allowsExchange(allowsLoans(handler))))
        )
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
                      awaitsPar(
                          decides(
                              'WaterfallAuction',
                              new WaterfallAuctionHandler(options.auctionRules)
                          )
                      )
                  ),
                  AuctionBidding: endsGame(
                      awaitsPar(
                          decides(
                              'AuctionBidding',
                              new WaterfallAuctionHandler(options.auctionRules)
                          )
                      )
                  )
              }
            : {}),
        ...(options.selectionAuctionRules
            ? {
                  SelectionAuction: endsGame(
                      decides(
                          'SelectionAuction',
                          new SelectionAuctionHandler(options.selectionAuctionRules)
                      )
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
            allowsPrivatePowerRequests(
                new StockInstructionHandler(
                    allowsCompanyDecisions(
                        new AutomaticStockTurnHandler(
                            allowsExchange(
                                decides(
                                    'StockRound',
                                    new StockRoundHandler(
                                        rules,
                                        'StartingOperatingSet',
                                        companyRules
                                    )
                                )
                            )
                        )
                    ),
                    rules
                )
            )
        ),
        StartingOperatingSet: endsGame(
            decides('StartingOperatingSet', new StartOperatingSetHandler(BetweenCompaniesState))
        ),
        OperatingSet: endsGame(
            allowsPrivatePowerRequests(
                new BetweenCompaniesHandler(
                    decides(
                        'OperatingSet',
                        choosesHome(
                            new StartOperatingTurnHandler(
                                options.stationRules,
                                operatingRules,
                                OperatingStepStates[0]
                            )
                        )
                    ),
                    options.privatePowerRules,
                    options.trackRules,
                    options.stationRules
                )
            )
        ),
        LayingTrack: new AutomaticTrackCompletionHandler(
            options.trackRules,
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
        ),
        ...(loanRules
            ? {
                  RepayingLoans: endsGame(
                      decides(
                          'RepayingLoans',
                          new RepayingLoansHandler(loanRules, options.trainRules)
                      )
                  )
              }
            : {}),
        ...(options.cashCrisisRules
            ? {
                  RaisingCash: endsGame(
                      decides('RaisingCash', new RaisingCashHandler(options.cashCrisisRules))
                  )
              }
            : {})
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
        ...auctionActions(
            options.offerAuctionRules,
            options.auctionRules,
            options.selectionAuctionRules
        ),
        ...fundingActions(options.trainFundingRules, rules, options.trainRules),
        ...privateActions(options),
        ...trackActions(options.trackRules),
        ...transferActions(options.transferRules, options.trainRules, rules),
        ...phaseActions(options),
        ...operatingActions(operatingRules, options.trainRules, options.endingRules, loanRules),
        ...loanActions(loanRules, rules),
        ...cashCrisisActions(options.cashCrisisRules),
        ...stockActions(rules),
        ...companyActions(companyRules, rules),
        ...stationActions(options.stationRules),
        ...routeActions(options.routeRules),
        ...earningsActions(
            options.earningsRules,
            options.privateRules,
            rules,
            after('DistributingEarnings')
        ),
        ...trainActions(options.trainRules, options.phaseRules, !loanRules),
        ...(options.titleActions ?? [])
    ])
    validateStateComposition(stateDefinition.schema, options, stateHandlers)
    const handledValidator = Compile(stateDefinition.schema)
    const canonicalStateValidator = {
        Check: (data: unknown): data is unknown =>
            handledValidator.Check(stateDefinition.read(data)),
        Type: () => stateDefinition.schema
    }
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
        canonicalStateValidator,
        playerColors: EighteenXXInitializer.playerColors,
        randomnessVersion: 1,
        scoring: {
            finalScores: (state) =>
                FinalWealthScoring.finalScores(stateDefinition.hydrate(state, map, tileSet, depot))
        },
        apiActions: actions.schemas,
        exploration: new EighteenXXGameExploration<Type.Static<Schema>>((state) =>
            stateDefinition.hydrate(state, map, tileSet, depot)
        ),
        stateHandlers
    }
}
