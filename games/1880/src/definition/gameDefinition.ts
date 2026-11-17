import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    SystemActionFirstHandler,
    createEighteenXXRuntime,
    playerLoanActions,
    repayPlayerLoanStep,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    ChoosingInvestorsHandler,
    InvestorActions1880,
    LeaseTrain,
    ReturnLeasedTrain,
    choosesInvestors,
    investorLeases,
    mergesInvestors
} from '../investors.js'
import { Names1880 } from '../names.js'
import { AuctionRules1880, createOpening1880, startingCash1880 } from '../opening.js'
import {
    EarningsRules1880,
    EndingRules1880,
    OperatingRules1880,
    PhaseRules1880,
    PrivateRules1880,
    TrainFundingRules1880,
    TransferRules1880
} from '../operating.js'
import {
    AssignEngineerStep,
    ClaimWoosongStep,
    ExchangeRocketStep,
    ExchangingRocketHandler,
    PhaseChanges1880,
    PrivateActions1880,
    PrivatePowerRules1880,
    changesPhaseAfterRocket
} from '../privatePowers.js'
import { RouteRules1880 } from '../routes.js'
import {
    ChoosingInvestorsState,
    ExchangingRocketState,
    State1880,
    StateDefinition1880,
    type HydratedState1880,
    type StateHandler1880
} from '../state.js'
import { StationRules1880 } from '../stations.js'
import { CompanyRules1880, PlayerLoanRules1880, StockRules1880 } from '../stock.js'
import { TrackRules1880 } from '../track.js'
import { TrainRules1880 } from '../trainRules.js'
import { Phases1880 } from '../trains.js'
import { Info1880 } from './info.js'

const rocket = (family: StateHandler1880): StateHandler1880 =>
    changesPhaseAfterRocket(new StepActionsHandler(family, [ExchangeRocketStep]))

export const TitleRules1880: EighteenXXTitleRules<typeof State1880, HydratedState1880> = {
    state: StateDefinition1880,
    endingRules: EndingRules1880,
    names: Names1880,
    selectionAuctionRules: AuctionRules1880,
    trainFundingRules: TrainFundingRules1880,
    transferRules: TransferRules1880,
    privatePowerRules: PrivatePowerRules1880,
    createOpening: createOpening1880,
    startingCash: startingCash1880,
    currencySymbol: '¥',
    stockRules: StockRules1880,
    companyRules: CompanyRules1880,
    operatingRules: OperatingRules1880,
    trackRules: TrackRules1880,
    stationRules: StationRules1880,
    earningsRules: EarningsRules1880,
    routeRules: RouteRules1880,
    privateRules: PrivateRules1880,
    phases: Phases1880,
    phaseRules: { ...PhaseRules1880, changes: PhaseChanges1880 },
    trainRules: TrainRules1880,
    runInstructions: true,
    stockRoundInterruptions: true,
    additionalConstructionActions: ['AssignEngineer', 'ExchangeRocket'],
    titleStateHandlers: {
        [ChoosingInvestorsState]: ChoosingInvestorsHandler,
        [ExchangingRocketState]: ExchangingRocketHandler
    },
    decisionHandlers: {
        SelectionAuction: choosesInvestors,
        StockRound: (family) =>
            new StepActionsHandler(family, [repayPlayerLoanStep(), ClaimWoosongStep]),
        OperatingSet: mergesInvestors,
        LayingTrack: (family) =>
            changesPhaseAfterRocket(
                new StepActionsHandler(family, [AssignEngineerStep, ExchangeRocketStep])
            ),
        PlacingStation: rocket,
        RunningTrains: (family) =>
            new SystemActionFirstHandler(rocket(family), LeaseTrain, investorLeases.leaseDue),
        BuyingTrains: (family) =>
            new SystemActionFirstHandler(
                rocket(family),
                ReturnLeasedTrain,
                investorLeases.returnDue
            )
    },
    titleActions: [
        ...InvestorActions1880,
        ...PrivateActions1880,
        ...playerLoanActions(PlayerLoanRules1880)
    ]
}

export const Definition: GameDefinition<State1880, HydratedState1880> = defineGame({
    info: Info1880,
    runtime: createEighteenXXRuntime(TitleRules1880)
})
