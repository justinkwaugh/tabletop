import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    MergerRoundMachineState,
    TrainlessMajorsState,
    createEighteenXXRuntime,
    type EighteenXXTitleRules,
    type PrivatePowerRules
} from '@tabletop/18xx'
import { LoanRules1861 } from '../loans.js'
import { MergerRounds1861 } from '../mergers.js'
import { ReceivershipRules1861 } from '../national.js'
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
    LoanSettlements1861,
    NationalActions1861,
    nationalisesBetweenCompanies,
    PhaseNationalisation1861,
    placesMoscowStation
} from '../phaseEffects.js'
import { RouteRules1861 } from '../routes.js'
import { State1861, StateDefinition1861, type HydratedState1861 } from '../state.js'
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
        OperatingSet: (family) => MergerRounds1861.starts(nationalisesBetweenCompanies(family)),
        LayingTrack: (family) => placesMoscowStation(family),
        BuyingTrains: (family) => LoanSettlements1861.settles(family),
        AdvancingPhase: (family) => PhaseNationalisation1861.applies(family)
    },
    titleStateHandlers: {
        [MergerRoundMachineState]: MergerRounds1861.handler('OperatingSet'),
        [TrainlessMajorsState]: PhaseNationalisation1861.handler()
    },
    titleActions: [
        ...LoanSettlements1861.actions(),
        ...PhaseNationalisation1861.actions(),
        ...NationalActions1861,
        ...MergerRounds1861.actions()
    ]
}

export const Definition: GameDefinition<State1861, HydratedState1861> = defineGame({
    info: Info1861,
    runtime: createEighteenXXRuntime(TitleRules1861)
})
