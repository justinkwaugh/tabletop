import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    type EighteenXXTitleRules,
    type PrivatePowerRules
} from '@tabletop/18xx'
import { defineSettleLoans, LoanRules1861, settlesLoans } from '../loans.js'
import { MergerActions1861, MergerRoundHandler, startsMergerRounds } from '../mergers.js'
import { MergerRoundState1861 } from '../mergerState.js'
import { nationalise1861, ReceivershipRules1861 } from '../national.js'
import { Names1861 } from '../names.js'
import { AuctionRules1861, createOpening1861 } from '../opening.js'
import { startingCash1861 } from '../companies.js'
import {
    CorporateFinanceRules1861,
    EarningsRules1861,
    EndingRules1861,
    OperatingRules1861,
    PhaseRules1861,
    PrivateRules1861,
    TrainRules1861,
    TransferRules1861
} from '../operating.js'
import {
    appliesPhaseEffects,
    NationalActions1861,
    nationalisesBetweenCompanies,
    PhaseEffectActions1861,
    placesMoscowStation,
    TrainlessMajorsHandler
} from '../phaseEffects.js'
import { RouteRules1861 } from '../routes.js'
import {
    State1861,
    StateDefinition1861,
    TrainlessMajorsState,
    type HydratedState1861
} from '../state.js'
import { StationRules1861 } from '../stations.js'
import { CompanyRules1861, StockRules1861 } from '../stock.js'
import { TrackRules1861 } from '../track.js'
import { Phases1861 } from '../trains.js'
import { Info1861 } from './info.js'

// No private has a power to use (§7.1).
const PrivatePowerRules1861: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}

export const TitleRules1861: EighteenXXTitleRules<typeof State1861, HydratedState1861> = {
    state: StateDefinition1861,
    endingRules: EndingRules1861,
    names: Names1861,
    selectionAuctionRules: AuctionRules1861,
    createOpening: createOpening1861,
    startingCash: ({ playerCount }) => startingCash1861(playerCount),
    currencySymbol: '₽',
    stockRules: StockRules1861,
    companyRules: CompanyRules1861,
    operatingRules: OperatingRules1861,
    trackRules: TrackRules1861,
    stationRules: StationRules1861,
    earningsRules: EarningsRules1861,
    routeRules: RouteRules1861,
    trainRules: TrainRules1861,
    runInstructions: true,
    phases: Phases1861,
    phaseRules: PhaseRules1861,
    privateRules: PrivateRules1861,
    privatePowerRules: PrivatePowerRules1861,
    transferRules: TransferRules1861,
    loanRules: LoanRules1861,
    receivershipRules: ReceivershipRules1861,
    corporateFinanceRules: CorporateFinanceRules1861,
    decisionHandlers: {
        OperatingSet: (family) => startsMergerRounds(nationalisesBetweenCompanies(family)),
        LayingTrack: (family) => placesMoscowStation(family),
        BuyingTrains: (family) => settlesLoans(family),
        AdvancingPhase: (family) => appliesPhaseEffects(family)
    },
    titleStateHandlers: {
        [MergerRoundState1861]: new MergerRoundHandler(),
        [TrainlessMajorsState]: new TrainlessMajorsHandler()
    },
    titleActions: [
        defineSettleLoans(nationalise1861),
        ...PhaseEffectActions1861,
        ...NationalActions1861,
        ...MergerActions1861
    ]
}

export const Definition: GameDefinition<State1861, HydratedState1861> = defineGame({
    info: Info1861,
    runtime: createEighteenXXRuntime(TitleRules1861)
})
