import { Visibility, type GameDefinition, type GameRuntime } from '@tabletop/common'
import {
    GameEndingHandler,
    createEighteenXXRuntime,
    defineAction,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { EndingRules1846 } from '../ending.js'
import { PublicDistributionActions, buyingOpeningCompaniesHandler } from '../publicDistribution.js'
import { ReceivershipRules1846 } from '../receivership.js'
import {
    BuildPrivateTrack,
    BuildPrivateTrackAction,
    isBuildPrivateTrack
} from '../privateConstruction.js'
import { PlaceCWIStation, PlaceCWIStationAction, isPlaceCWIStation } from '../privateStation.js'
import { PrivatePowersHandler } from '../privatePowersHandler.js'
import { TransferRules1846 } from '../acquisitions.js'
import {
    AssignRevenueMarker,
    AssignRevenueMarkerValidator,
    AssignRevenueMarkerAction
} from '../revenueMarkers.js'
import { PhaseRules1846 } from '../phases.js'
import { TrainFundingRules1846 } from '../trainFundingRules.js'
import { Phases1846, TrainRules1846 } from '../trains.js'
import { EarningsRules1846 } from '../earnings.js'
import { StationRules1846 } from '../stations.js'
import {
    CorporateFinance,
    CorporateFinanceValidator,
    CorporateFinanceAction
} from '../corporateFinance.js'
import { RouteRules1846 } from '../routes.js'
import { AssignSteamboat, AssignSteamboatValidator, AssignSteamboatAction } from '../steamboat.js'
import {
    SettleIndependent,
    SettleIndependentValidator,
    SettleIndependentAction
} from '../settleIndependent.js'
import { OperatingRules1846 } from '../operating.js'
import { TrackRules1846 } from '../track.js'
import {
    CloseCorporation,
    CloseCorporationValidator,
    CloseCorporationAction
} from '../closeCorporation.js'
import { StockRules1846, CompanyRules1846 } from '../stock.js'
import {
    EighteenFortySixState,
    EighteenFortySixProjectedState,
    EighteenFortySixStateDefinition,
    type HydratedEighteenFortySixState
} from '../state.js'
import { createOpening1846 } from '../opening.js'
import { PrivatePowerRules1846, PrivateRules1846 } from '../privateRules.js'
import { Names1846 } from '../names.js'
import {
    ChooseDraftCard,
    PassFinalCompany,
    RevealDraft,
    ChooseValidator,
    PassValidator,
    RevealValidator,
    ChooseAction,
    PassAction,
    RevealAction
} from '../actions.js'
import {
    assigningSteamboatHandler,
    buyingTrains1846,
    closingOperatingCorporationHandler,
    distributingEarnings1846,
    draftingHandler,
    fundingTrain1846,
    layingTrack1846,
    operatingSet1846,
    revealingDraftHandler,
    runningTrains1846,
    settlingIndependentHandler,
    stockRound1846
} from './handlers.js'
import { EighteenFortySixInfo } from './info.js'

type Handler = EighteenXXStateHandler<HydratedEighteenFortySixState>
const endsGame = (handler: Handler): Handler => new GameEndingHandler(handler, EndingRules1846)
const withPrivatePowers =
    (decide: (family: Handler) => Handler) =>
    (family: Handler): Handler =>
        new PrivatePowersHandler(decide(family))

export const TitleRules1846: EighteenXXTitleRules<
    typeof EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    state: EighteenFortySixStateDefinition,
    canonicalState: {
        schema: EighteenFortySixState,
        projector: Visibility.createProjector(EighteenFortySixState)
    },
    endingRules: EndingRules1846,
    names: Names1846,
    createOpening: createOpening1846,
    stockRules: StockRules1846,
    companyRules: CompanyRules1846,
    operatingRules: OperatingRules1846,
    trackRules: TrackRules1846,
    stationRules: StationRules1846,
    earningsRules: EarningsRules1846,
    routeRules: RouteRules1846,
    trainRules: TrainRules1846,
    phases: Phases1846,
    phaseRules: PhaseRules1846,
    trainFundingRules: TrainFundingRules1846,
    receivershipRules: ReceivershipRules1846,
    privateRules: PrivateRules1846,
    privatePowerRules: PrivatePowerRules1846,
    transferRules: TransferRules1846,
    operatingSteps: ['LayingTrack', 'RunningTrains', 'DistributingEarnings', 'BuyingTrains'],
    additionalConstructionActions: [
        'PlaceStation',
        'BuildPrivateTrack',
        'PlaceCWIStation',
        'CorporateFinance'
    ],
    decisionHandlers: {
        StockRound: stockRound1846,
        OperatingSet: operatingSet1846,
        LayingTrack: withPrivatePowers(layingTrack1846),
        RunningTrains: withPrivatePowers(runningTrains1846),
        DistributingEarnings: withPrivatePowers(distributingEarnings1846),
        BuyingTrains: withPrivatePowers(buyingTrains1846),
        FundingTrain: fundingTrain1846
    },
    titleStateHandlers: {
        Drafting: endsGame(draftingHandler),
        RevealingDraft: endsGame(revealingDraftHandler),
        BuyingOpeningCompanies: endsGame(buyingOpeningCompaniesHandler),
        AssigningSteamboat: endsGame(assigningSteamboatHandler),
        SettlingIndependent: endsGame(settlingIndependentHandler),
        ClosingOperatingCorporation: endsGame(closingOperatingCorporationHandler)
    },
    titleActions: [
        defineAction(
            ChooseDraftCard,
            (data) => ChooseValidator.Check(data),
            (data) => new ChooseAction(data)
        ),
        defineAction(
            PassFinalCompany,
            (data) => PassValidator.Check(data),
            (data) => new PassAction(data)
        ),
        defineAction(
            RevealDraft,
            (data) => RevealValidator.Check(data),
            (data) => new RevealAction(data)
        ),
        defineAction(
            CloseCorporation,
            (data) => CloseCorporationValidator.Check(data),
            (data) => new CloseCorporationAction(data)
        ),
        defineAction(
            AssignSteamboat,
            (data) => AssignSteamboatValidator.Check(data),
            (data) => new AssignSteamboatAction(data)
        ),
        defineAction(
            SettleIndependent,
            (data) => SettleIndependentValidator.Check(data),
            (data) => new SettleIndependentAction(data)
        ),
        defineAction(
            CorporateFinance,
            (data) => CorporateFinanceValidator.Check(data),
            (data) => new CorporateFinanceAction(data)
        ),
        defineAction(
            AssignRevenueMarker,
            (data) => AssignRevenueMarkerValidator.Check(data),
            (data) => new AssignRevenueMarkerAction(data)
        ),
        ...PublicDistributionActions,
        defineAction(
            BuildPrivateTrack,
            isBuildPrivateTrack,
            (data) => new BuildPrivateTrackAction(data)
        ),
        defineAction(PlaceCWIStation, isPlaceCWIStation, (data) => new PlaceCWIStationAction(data))
    ]
}

export const Definition: GameDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = { info: EighteenFortySixInfo, runtime: createEighteenXXRuntime(TitleRules1846) }
export const Runtime: GameRuntime<EighteenFortySixProjectedState, HydratedEighteenFortySixState> =
    Definition.runtime
