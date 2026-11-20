import { defineGame, type GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import {
    CobourgActions1828,
    closesCobourg,
    cobourgRunHeld,
    offersCobourgStation,
    runsCobourg
} from '../cobourg.js'
import { AccessRightRules1828 } from '../coal.js'
import { MergerActions1828, mergesCompanies } from '../merger.js'
import { MohawkActions1828, MohawkExchangeSteps, notesOperatingStart } from '../mohawk.js'
import { Names1828 } from '../names.js'
import { AuctionRules1828, createOpening1828, startingCash1828 } from '../opening.js'
import {
    EarningsRules1828,
    EndingRules1828,
    OperatingRules1828,
    PhaseRules1828,
    PrivateRules1828,
    TrainFundingRules1828,
    TransferRules1828
} from '../operating.js'
import { PrivatePowerRules1828 } from '../privatePowers.js'
import { RouteRules1828 } from '../routes.js'
import { arrangesShells, fundsEmptyShell, placesShellTrains, ShellActions1828 } from '../shells.js'
import { State1828, StateDefinition1828, type HydratedState1828 } from '../state.js'
import { StationRules1828, placesErieHome } from '../stations.js'
import { CompanyRules1828, StockRules1828 } from '../stock.js'
import { TrackRules1828 } from '../track.js'
import { TrainRules1828 } from '../trainRules.js'
import { Phases1828 } from '../trains.js'
import { UnparredActions1828, removesUnparredCompanies } from '../unparred.js'
import { Info1828 } from './info.js'

export const TitleRules1828: EighteenXXTitleRules<typeof State1828, HydratedState1828> = {
    state: StateDefinition1828,
    endingRules: EndingRules1828,
    names: Names1828,
    auctionRules: AuctionRules1828,
    trainFundingRules: TrainFundingRules1828,
    transferRules: TransferRules1828,
    privatePowerRules: PrivatePowerRules1828,
    createOpening: createOpening1828,
    startingCash: startingCash1828,
    currencySymbol: '$',
    stockRules: StockRules1828,
    companyRules: CompanyRules1828,
    operatingRules: OperatingRules1828,
    trackRules: TrackRules1828,
    stationRules: StationRules1828,
    earningsRules: EarningsRules1828,
    routeRules: RouteRules1828,
    privateRules: PrivateRules1828,
    phases: Phases1828,
    phaseRules: PhaseRules1828,
    trainRules: TrainRules1828,
    accessRightRules: AccessRightRules1828,
    outOfTurnPrivatePowers: true,
    privateExchangeActions: MohawkExchangeSteps,
    runInstructions: true,
    runInstructionsHeld: cobourgRunHeld,
    decisionHandlers: {
        StockRound: (family) => removesUnparredCompanies(mergesCompanies(family)),
        OperatingSet: (family) => placesShellTrains(closesCobourg(family)),
        LayingTrack: (family) => placesErieHome(offersCobourgStation(family)),
        PlacingStation: (family) => offersCobourgStation(family),
        RunningTrains: (family) => runsCobourg(offersCobourgStation(family)),
        DistributingEarnings: (family) => offersCobourgStation(family),
        BuyingTrains: (family) => placesShellTrains(arrangesShells(offersCobourgStation(family))),
        FundingTrain: (family) => placesShellTrains(fundsEmptyShell(family))
    },
    actionObservers: {
        OperatingSet: notesOperatingStart,
        LayingTrack: notesOperatingStart
    },
    titleActions: [
        ...CobourgActions1828,
        ...MergerActions1828,
        ...MohawkActions1828,
        ...ShellActions1828,
        ...UnparredActions1828
    ]
}

export const Definition: GameDefinition<State1828, HydratedState1828> = defineGame({
    info: Info1828,
    runtime: createEighteenXXRuntime(TitleRules1828)
})
