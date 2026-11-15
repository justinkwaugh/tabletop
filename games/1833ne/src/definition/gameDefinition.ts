import type { GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    defineAction,
    DiscardMergedTrain,
    HydratedDiscardMergedTrain,
    isDiscardMergedTrain,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    AssignLuxuryFerry,
    AssignLuxuryFerryAction,
    AssignLuxuryFerryValidator,
    BuyFerry,
    BuyFerryAction,
    BuyFerryValidator
} from '../ferries.js'
import { AuctionRules1833NE, createOpening1833NE, startingCash1833NE } from '../opening.js'
import {
    EndingRules1833NE,
    Names1833NE,
    OperatingRules1833NE,
    ReceivershipRules1833NE,
    TrainFundingRules1833NE,
    ZeroPriceClosure1833NE
} from '../operating.js'
import { PrivatePowerRules1833NE, PrivateRules1833NE, TransferRules1833NE } from '../privates.js'
import { RouteRules1833NE } from '../routes.js'
import { StateDefinition1833NE, type HydratedState1833NE, type State1833NE } from '../state.js'
import { PhaseRules1833NE, StationRules1833NE } from '../stations.js'
import { CorporateFinanceRules1833NE, EarningsRules1833NE, StockRules1833NE } from '../stock.js'
import { TrackRules1833NE } from '../track.js'
import { CompanyRules1833NE } from '../variableStart.js'
import { Phases1833NE, TrainRules1833NE } from '../trains.js'
import {
    AnswerTakeover,
    EndTakeoverStep,
    HydratedAnswerTakeover,
    HydratedEndTakeoverStep,
    HydratedOfferTakeover,
    HydratedPassTakeover,
    HydratedStartTakeoverStep,
    OfferTakeover,
    PassTakeover,
    StartTakeoverStep,
    TakeoverStepHandler,
    isAnswerTakeover,
    isEndTakeoverStep,
    isOfferTakeover,
    isPassTakeover,
    isStartTakeoverStep,
    MergedTrainDiscards1833NE,
    startsTakeoverSteps
} from '../takeoverStep.js'
import { TakingOverState } from '../takeoverState.js'
import { layingTrack1833NE, operatingSet1833NE, runningTrains1833NE } from './handlers.js'
import { Info1833NE } from './info.js'

export const TitleRules1833NE: EighteenXXTitleRules<typeof State1833NE, HydratedState1833NE> = {
    state: StateDefinition1833NE,
    endingRules: EndingRules1833NE,
    names: Names1833NE,
    auctionRules: AuctionRules1833NE,
    createOpening: createOpening1833NE,
    startingCash: startingCash1833NE,
    currencySymbol: '$',
    stockRules: StockRules1833NE,
    companyRules: CompanyRules1833NE,
    operatingRules: OperatingRules1833NE,
    trackRules: TrackRules1833NE,
    stationRules: StationRules1833NE,
    earningsRules: EarningsRules1833NE,
    routeRules: RouteRules1833NE,
    trainRules: TrainRules1833NE,
    runInstructions: true,
    phases: Phases1833NE,
    phaseRules: PhaseRules1833NE,
    trainFundingRules: TrainFundingRules1833NE,
    receivershipRules: ReceivershipRules1833NE,
    privateRules: PrivateRules1833NE,
    privatePowerRules: PrivatePowerRules1833NE,
    outOfTurnPrivatePowers: true,
    transferRules: TransferRules1833NE,
    corporateFinanceRules: CorporateFinanceRules1833NE,
    zeroPriceClosure: ZeroPriceClosure1833NE,
    stationsWithTrack: true,
    operatingSteps: ['LayingTrack', 'RunningTrains', 'DistributingEarnings', 'BuyingTrains'],
    additionalConstructionActions: ['BuyFerry', 'AssignLuxuryFerry'],
    decisionHandlers: {
        OperatingSet: (family) => operatingSet1833NE(startsTakeoverSteps(family)),
        LayingTrack: layingTrack1833NE,
        RunningTrains: runningTrains1833NE
    },
    titleStateHandlers: { [TakingOverState]: new TakeoverStepHandler() },
    titleActions: [
        defineAction(
            StartTakeoverStep,
            isStartTakeoverStep,
            (action) => new HydratedStartTakeoverStep(action)
        ),
        defineAction(
            EndTakeoverStep,
            isEndTakeoverStep,
            (action) => new HydratedEndTakeoverStep(action, EndingRules1833NE)
        ),
        defineAction(OfferTakeover, isOfferTakeover, (action) => new HydratedOfferTakeover(action)),
        defineAction(
            AnswerTakeover,
            isAnswerTakeover,
            (action) => new HydratedAnswerTakeover(action)
        ),
        defineAction(PassTakeover, isPassTakeover, (action) => new HydratedPassTakeover(action)),
        defineAction(
            DiscardMergedTrain,
            isDiscardMergedTrain,
            (action) =>
                new HydratedDiscardMergedTrain(action, TrainRules1833NE, MergedTrainDiscards1833NE)
        ),
        defineAction(
            BuyFerry,
            (data) => BuyFerryValidator.Check(data),
            (data) => new BuyFerryAction(data)
        ),
        defineAction(
            AssignLuxuryFerry,
            (data) => AssignLuxuryFerryValidator.Check(data),
            (data) => new AssignLuxuryFerryAction(data)
        )
    ]
}

export const Definition: GameDefinition<State1833NE, HydratedState1833NE> = {
    info: Info1833NE,
    runtime: createEighteenXXRuntime(TitleRules1833NE)
}
