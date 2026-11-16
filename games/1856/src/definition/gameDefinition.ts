import { defineGame, type GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { CapitalizationActions1856, capitalizesCompanies } from '../capitalization.js'
import { DestinationActions1856, reachesDestinations } from '../destinations.js'
import { LoanActions1856, LoanRules1856, redeemsExcessLoans } from '../loans.js'
import { Names1856 } from '../names.js'
import { NationalActions1856, NationalFormationHandler, formsNational } from '../national.js'
import { AuctionRules1856, createOpening1856, startingCash1856 } from '../opening.js'
import {
    CashCrisisRules1856,
    EarningsRules1856,
    EndingRules1856,
    OperatingRules1856,
    PhaseRules1856,
    PrivateRules1856,
    TrainFundingRules1856,
    TrainRules1856,
    TransferRules1856,
    ZeroPriceClosure1856
} from '../operating.js'
import {
    NationalOperationActions1856,
    borrowsTrain,
    completesNationalPresidency,
    notesNationalPermanentTrain,
    returnsBorrowedTrain
} from '../nationalOperation.js'
import { OperatingTurnActions1856, floatsAtFirstTurn } from '../operatingTurns.js'
import { PrivatePowerRules1856 } from '../privatePowers.js'
import { AccessRightRules1856 } from '../rights.js'
import { RouteRules1856 } from '../routes.js'
import {
    NationalFormationState,
    State1856,
    StateDefinition1856,
    type HydratedState1856
} from '../state.js'
import { StationRules1856 } from '../stations.js'
import { CompanyRules1856, StockRules1856 } from '../stock.js'
import { TrackRules1856 } from '../track.js'
import { Phases1856 } from '../trains.js'
import { Info1856 } from './info.js'

export const TitleRules1856: EighteenXXTitleRules<typeof State1856, HydratedState1856> = {
    state: StateDefinition1856,
    endingRules: EndingRules1856,
    names: Names1856,
    auctionRules: AuctionRules1856,
    createOpening: createOpening1856,
    startingCash: startingCash1856,
    currencySymbol: '$',
    stockRules: StockRules1856,
    companyRules: CompanyRules1856,
    operatingRules: OperatingRules1856,
    trackRules: TrackRules1856,
    stationRules: StationRules1856,
    earningsRules: EarningsRules1856,
    routeRules: RouteRules1856,
    trainRules: TrainRules1856,
    runInstructions: true,
    phases: Phases1856,
    phaseRules: PhaseRules1856,
    privateRules: PrivateRules1856,
    privatePowerRules: PrivatePowerRules1856,
    transferRules: TransferRules1856,
    trainFundingRules: TrainFundingRules1856,
    loanRules: LoanRules1856,
    cashCrisisRules: CashCrisisRules1856,
    accessRightRules: AccessRightRules1856,
    zeroPriceClosure: ZeroPriceClosure1856,
    decisionHandlers: {
        OperatingSet: (family) =>
            formsNational(notesNationalPermanentTrain(floatsAtFirstTurn(family))),
        LayingTrack: (family) => reachesDestinations(family),
        RunningTrains: (family) => borrowsTrain(family),
        BuyingTrains: (family) => returnsBorrowedTrain(family),
        RepayingLoans: (family) => redeemsExcessLoans(family),
        StockRound: (family) => capitalizesCompanies(completesNationalPresidency(family))
    },
    titleStateHandlers: { [NationalFormationState]: new NationalFormationHandler() },
    titleActions: [
        ...CapitalizationActions1856,
        ...DestinationActions1856,
        ...LoanActions1856,
        ...OperatingTurnActions1856,
        ...NationalActions1856,
        ...NationalOperationActions1856
    ]
}

export const Definition: GameDefinition<State1856, HydratedState1856> = defineGame({
    info: Info1856,
    runtime: createEighteenXXRuntime(TitleRules1856)
})
