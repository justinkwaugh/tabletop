import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    createEighteenXXRuntime,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { AuctionActions, ChoiceAuctionHandler } from '../auction.js'
import { BankPrivateActions, BankPrivateSteps } from '../bankPrivates.js'
import { BankruptcyActions, bankruptsCompanies } from '../bankruptcy.js'
import { EndingRules1860 } from '../ending.js'
import {
    EndgameActions,
    beginsSouthernStockRound,
    formsBritishRailAfterStockRound,
    recordsNationalDividends,
    runsEndgameAfterRounds
} from '../endgame.js'
import { HomeTileActions, LayingHomeTileHandler, laysHomeTiles } from '../homeTile.js'
import { InsolvencyActions, judgesInsolvency } from '../insolvency.js'
import { Names1860 } from '../names.js'
import { createOpening1860, startingCash1860 } from '../opening.js'
import {
    EarningsRules1860,
    OperatingRules1860,
    PhaseRules1860,
    PrivatePowerRules1860,
    ReceivershipRules1860,
    TrainRules1860,
    TransferRules1860
} from '../operating.js'
import { ReturnTrainActions, ReturningTrainsHandler, returnsExcessTrains } from '../returnTrains.js'
import { RouteRules1860 } from '../routes.js'
import {
    ChoiceAuctionState,
    LayingHomeTileState,
    ReturningTrainsState,
    State1860,
    StateDefinition1860,
    type HydratedState1860
} from '../state.js'
import { StationRules1860 } from '../stations.js'
import { CompanyRules1860, PrivateRules1860, StockRules1860 } from '../stock.js'
import { TrackRules1860 } from '../track.js'
import { Phases1860 } from '../trains.js'
import { Info1860 } from './info.js'

export const TitleRules1860: EighteenXXTitleRules<typeof State1860, HydratedState1860> = {
    state: StateDefinition1860,
    endingRules: EndingRules1860,
    names: Names1860,
    createOpening: createOpening1860,
    startingCash: startingCash1860,
    currencySymbol: '£',
    stockRules: StockRules1860,
    companyRules: CompanyRules1860,
    operatingRules: OperatingRules1860,
    trackRules: TrackRules1860,
    stationRules: StationRules1860,
    earningsRules: EarningsRules1860,
    routeRules: RouteRules1860,
    trainRules: TrainRules1860,
    phases: Phases1860,
    phaseRules: PhaseRules1860,
    privateRules: PrivateRules1860,
    privatePowerRules: PrivatePowerRules1860,
    transferRules: TransferRules1860,
    receivershipRules: ReceivershipRules1860,
    runInstructions: true,
    decisionHandlers: {
        StockRound: (family) =>
            bankruptsCompanies(
                beginsSouthernStockRound(
                    laysHomeTiles(new StepActionsHandler(family, BankPrivateSteps))
                )
            ),
        StartingOperatingSet: (family) => formsBritishRailAfterStockRound(family),
        OperatingSet: (family) =>
            bankruptsCompanies(
                judgesInsolvency(runsEndgameAfterRounds(returnsExcessTrains(family)))
            ),
        DistributingEarnings: (family) => recordsNationalDividends(family),
        // A company bankrupt by its own dividend ends its turn (Bankrupt Companies).
        BuyingTrains: (family) =>
            bankruptsCompanies(family, (state) =>
                state.trainPurchaseStep ? 'BuyingTrains' : 'OperatingSet'
            )
    },
    titleStateHandlers: {
        [ChoiceAuctionState]: new ChoiceAuctionHandler(),
        [LayingHomeTileState]: new LayingHomeTileHandler(),
        [ReturningTrainsState]: new ReturningTrainsHandler()
    },
    titleActions: [
        ...AuctionActions,
        ...HomeTileActions,
        ...BankPrivateActions,
        ...InsolvencyActions,
        ...BankruptcyActions,
        ...EndgameActions,
        ...ReturnTrainActions
    ]
}

export const Definition: GameDefinition<State1860, HydratedState1860> = defineGame({
    info: Info1860,
    runtime: createEighteenXXRuntime(TitleRules1860)
})
