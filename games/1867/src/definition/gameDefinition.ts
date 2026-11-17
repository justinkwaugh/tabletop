import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    MergerRoundMachineState,
    TrainlessMajorsState,
    createEighteenXXRuntime,
    type EighteenXXTitleRules,
    type PrivatePowerRules
} from '@tabletop/18xx'
import { startingCash1867 } from '../companies.js'
import { LoanRules1867 } from '../loans.js'
import { MergerRounds1867 } from '../mergers.js'
import { Names1867 } from '../names.js'
import { AuctionRules1867, createOpening1867 } from '../opening.js'
import {
    CorporateFinanceRules1867,
    EarningsRules1867,
    EndingRules1867,
    OperatingRules1867,
    PhaseRules1867,
    PrivateRules1867,
    TrainRules1867,
    TransferRules1867
} from '../operating.js'
import {
    LoanSettlements1867,
    NationalActions1867,
    PhaseNationalisation1867,
    placesMontrealStation
} from '../phaseEffects.js'
import { RouteRules1867 } from '../routes.js'
import { State1867, StateDefinition1867, type HydratedState1867 } from '../state.js'
import { StationRules1867 } from '../stations.js'
import { CompanyRules1867, StockRules1867 } from '../stock.js'
import { TrackRules1867 } from '../track.js'
import { Phases1867 } from '../trains.js'
import { Info1867 } from './info.js'

// No private has a power to use (GTG §3.1).
const PrivatePowerRules1867: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}

export const TitleRules1867: EighteenXXTitleRules<typeof State1867, HydratedState1867> = {
    state: StateDefinition1867,
    endingRules: EndingRules1867,
    names: Names1867,
    selectionAuctionRules: AuctionRules1867,
    createOpening: createOpening1867,
    startingCash: ({ playerCount }) => startingCash1867(playerCount),
    currencySymbol: '$',
    stockRules: StockRules1867,
    companyRules: CompanyRules1867,
    operatingRules: OperatingRules1867,
    trackRules: TrackRules1867,
    stationRules: StationRules1867,
    earningsRules: EarningsRules1867,
    routeRules: RouteRules1867,
    trainRules: TrainRules1867,
    runInstructions: true,
    phases: Phases1867,
    phaseRules: PhaseRules1867,
    privateRules: PrivateRules1867,
    privatePowerRules: PrivatePowerRules1867,
    transferRules: TransferRules1867,
    loanRules: LoanRules1867,
    corporateFinanceRules: CorporateFinanceRules1867,
    decisionHandlers: {
        OperatingSet: (family) =>
            MergerRounds1867.starts(
                PhaseNationalisation1867.nationalisesTrainlessFinishers(family)
            ),
        LayingTrack: (family) => placesMontrealStation(family),
        BuyingTrains: (family) => LoanSettlements1867.settles(family),
        AdvancingPhase: (family) => PhaseNationalisation1867.applies(family)
    },
    titleStateHandlers: {
        [MergerRoundMachineState]: MergerRounds1867.handler('OperatingSet'),
        [TrainlessMajorsState]: PhaseNationalisation1867.handler()
    },
    titleActions: [
        ...LoanSettlements1867.actions(),
        ...PhaseNationalisation1867.actions(),
        ...NationalActions1867,
        ...MergerRounds1867.actions()
    ]
}

export const Definition: GameDefinition<State1867, HydratedState1867> = defineGame({
    info: Info1867,
    runtime: createEighteenXXRuntime(TitleRules1867)
})
