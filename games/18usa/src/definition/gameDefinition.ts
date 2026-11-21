import { EighteenUSANames } from '../names.js'
import type { GameDefinition } from '@tabletop/common'
import {
    ActingCompanyActionsHandler,
    createEighteenXXRuntime,
    type ActingCompanyAction,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    BuyPullmanCompanyAction,
    PullmanActions,
    ScrapPullmanCompanyAction,
    ScrapPullmanStockAction
} from '../pullmans.js'
import { AssignTrainPowerCompanyAction, TrainAssignmentActions } from '../trainAssignments.js'
import {
    TrackTitleActions,
    TurnDenverCompanyAction,
    UpgradeOreCompanyAction
} from '../trackActions.js'
import { EighteenUSAEndingRules } from '../endingRules.js'
import {
    EighteenUSAAuctionRules,
    createEighteenUSAOpening,
    eighteenUSAStartingCash
} from '../openingAuction.js'
import { EighteenUSATrainFundingRules } from '../trainFundingRules.js'
import { EighteenUSATransferRules } from '../transferRules.js'
import { EighteenUSAPrivatePowerRules } from '../privatePowerRules.js'
import { EighteenUSAPrivateRules } from '../privateRules.js'
import {
    BoneyardActions,
    EighteenUSAPhaseRules,
    SavingTrainHandler,
    SavingTrainState
} from '../boneyard.js'
import { EighteenUSAEarningsRules } from '../earningsRules.js'
import { EighteenUSARouteRules } from '../routeRules.js'
import { EighteenUSAPhases } from '../trains.js'
import { EighteenUSATrainRules } from '../trainRules.js'
import { EighteenUSAStationRules } from '../stationRules.js'
import { EighteenUSATrackRules } from '../trackRules.js'
import { EighteenUSAOperatingRules } from '../roundRules.js'
import { EighteenUSACompanyRules } from '../companyRules.js'
import { EighteenUSAStockRules } from '../stockRules.js'
import { EighteenUSAInfo } from './info.js'
import {
    EighteenUSAStateDefinition,
    EighteenUSAState,
    type HydratedEighteenUSAState
} from '../state.js'
import { EighteenUSALoanRules } from '../loanRules.js'
import { EighteenUSACashCrisisRules } from '../bankruptcy.js'
import { EighteenUSAStations } from '../owedStations.js'
import { liquidatesUnsoldCompanies } from '../unsoldCompanies.js'
import {
    EighteenUSAAcquisitionRounds,
    EighteenUSABuyBacks,
    EighteenUSACompanyExcess,
    EighteenUSAConversionRounds,
    EighteenUSALiquidations,
    EighteenUSAShortSelling
} from '../companyRounds.js'

const beforeRun = [BuyPullmanCompanyAction, ScrapPullmanCompanyAction]
const running = [...beforeRun, AssignTrainPowerCompanyAction]
const laying = [...beforeRun, UpgradeOreCompanyAction, TurnDenverCompanyAction]
const afterRun = [ScrapPullmanCompanyAction]

function offersPullmans(
    family: EighteenXXStateHandler<HydratedEighteenUSAState>,
    actions: readonly ActingCompanyAction<HydratedEighteenUSAState>[]
): EighteenXXStateHandler<HydratedEighteenUSAState> {
    return new ActingCompanyActionsHandler(
        family,
        actions,
        (state) =>
            state.trackStep?.companyId ??
            state.stationStep?.companyId ??
            state.routeStep?.companyId ??
            state.trainPurchaseStep?.companyId ??
            state.loanStep?.companyId
    )
}

export const EighteenUSATitleRules: EighteenXXTitleRules<
    typeof EighteenUSAState,
    HydratedEighteenUSAState
> = {
    state: EighteenUSAStateDefinition,
    endingRules: EighteenUSAEndingRules,
    names: EighteenUSANames,
    selectionAuctionRules: EighteenUSAAuctionRules,
    trainFundingRules: EighteenUSATrainFundingRules,
    transferRules: EighteenUSATransferRules,
    privatePowerRules: EighteenUSAPrivatePowerRules,
    createOpening: createEighteenUSAOpening,
    startingCash: eighteenUSAStartingCash,
    currencySymbol: '$',
    stockRules: EighteenUSAStockRules,
    companyRules: EighteenUSACompanyRules,
    operatingRules: EighteenUSAOperatingRules,
    trackRules: EighteenUSATrackRules,
    stationRules: EighteenUSAStationRules,
    earningsRules: EighteenUSAEarningsRules,
    routeRules: EighteenUSARouteRules,
    privateRules: EighteenUSAPrivateRules,
    phases: EighteenUSAPhases,
    phaseRules: EighteenUSAPhaseRules,
    trainRules: EighteenUSATrainRules,
    runInstructions: true,
    loanRules: EighteenUSALoanRules,
    cashCrisisRules: EighteenUSACashCrisisRules,
    decisionHandlers: {
        StockRound: (family) =>
            EighteenUSAStations.buysOwedStations(
                EighteenUSAShortSelling.shortsInStockRound(
                    EighteenUSABuyBacks.corporateActionsHandler(family, [ScrapPullmanStockAction])
                )
            ),
        LayingTrack: (family) => offersPullmans(family, laying),
        PlacingStation: (family) => offersPullmans(family, beforeRun),
        RunningTrains: (family) => offersPullmans(family, running),
        BuyingTrains: (family) => offersPullmans(family, afterRun),
        RepayingLoans: (family) => offersPullmans(family, afterRun),
        StartingOperatingSet: (family) =>
            EighteenUSAStations.buysOwedStations(
                EighteenUSAStations.liquidatesUnpaidStations(liquidatesUnsoldCompanies(family))
            ),
        OperatingSet: (family) =>
            EighteenUSALiquidations.liquidatesTrainlessCompanies(
                EighteenUSAConversionRounds.starts(
                    EighteenUSAAcquisitionRounds.starts(
                        EighteenUSAShortSelling.buysOutMarketShorts(family)
                    )
                )
            )
    },
    titleStateHandlers: {
        ...EighteenUSAConversionRounds.stateHandlers('OperatingSet'),
        ...EighteenUSACompanyExcess.stateHandlers(),
        ...EighteenUSAAcquisitionRounds.stateHandlers('OperatingSet'),
        [SavingTrainState]: SavingTrainHandler
    },
    titleActions: [
        ...EighteenUSAConversionRounds.actions(),
        ...EighteenUSACompanyExcess.actions(),
        ...EighteenUSAAcquisitionRounds.actions(),
        ...EighteenUSAShortSelling.actions(),
        ...EighteenUSABuyBacks.actions(),
        ...EighteenUSAStations.actions(),
        ...EighteenUSALiquidations.actions(),
        ...PullmanActions,
        ...TrainAssignmentActions,
        ...TrackTitleActions,
        ...BoneyardActions
    ]
}

export const Definition: GameDefinition<EighteenUSAState, HydratedEighteenUSAState> = {
    info: EighteenUSAInfo,
    runtime: createEighteenXXRuntime(EighteenUSATitleRules)
}
