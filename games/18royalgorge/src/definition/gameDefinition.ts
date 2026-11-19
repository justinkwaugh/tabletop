import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    createEighteenXXRuntime,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    BridgeLeaseActions,
    PayBridgeLeaseStep,
    UseBridgeLeaseStep,
    awaitsBridgeLease
} from '../bridgeLease.js'
import { DebtActions, PayDebtStep } from '../debt.js'
import { ExtendTrainStep, ExtensionActions, mineCoal } from '../extensions.js'
import { GoldActions, GoldSteps } from '../gold.js'
import { NamesRoyalGorge } from '../names.js'
import {
    AuctionRulesRoyalGorge,
    createOpeningRoyalGorge,
    startingCashRoyalGorge
} from '../opening.js'
import {
    EarningsRulesRoyalGorge,
    EndingRulesRoyalGorge,
    OperatingRulesRoyalGorge,
    PhaseRulesRoyalGorge,
    PrivateRulesRoyalGorge,
    TrainFundingRulesRoyalGorge,
    TrainRulesRoyalGorge,
    TransferRulesRoyalGorge
} from '../operating.js'
import {
    BuyMetalSharesStep,
    MetalPurchaseActions,
    PrivatePowerRulesRoyalGorge
} from '../privatePowers.js'
import { RouteRulesRoyalGorge } from '../routes.js'
import { SettlementActions, settlesRounds } from '../settlement.js'
import {
    StateDefinitionRoyalGorge,
    StateRoyalGorge,
    type HydratedStateRoyalGorge
} from '../state.js'
import { StationRulesRoyalGorge } from '../stations.js'
import { ChooseSteelStep, SteelActions } from '../steel.js'
import { CompanyRulesRoyalGorge, StockRulesRoyalGorge } from '../stock.js'
import { TrackRulesRoyalGorge } from '../track.js'
import { PhasesRoyalGorge } from '../trains.js'
import { InfoRoyalGorge } from './info.js'

/** What lasts only for an operating turn: its steel, gold, train extensions and lease. */
function startsTurn(state: HydratedStateRoyalGorge, action: { type: string }): void {
    if (action.type !== 'StartOperatingTurn') return
    delete state.steelTurn
    delete state.goldShipment
    delete state.bridgeLeaseInUse
    delete state.bridgeLeasePaid
    state.trainExtensions = []
}

export const TitleRulesRoyalGorge: EighteenXXTitleRules<
    typeof StateRoyalGorge,
    HydratedStateRoyalGorge
> = {
    state: StateDefinitionRoyalGorge,
    endingRules: EndingRulesRoyalGorge,
    names: NamesRoyalGorge,
    selectionAuctionRules: AuctionRulesRoyalGorge,
    trainFundingRules: TrainFundingRulesRoyalGorge,
    transferRules: TransferRulesRoyalGorge,
    privatePowerRules: PrivatePowerRulesRoyalGorge,
    createOpening: createOpeningRoyalGorge,
    startingCash: startingCashRoyalGorge,
    currencySymbol: '$',
    stockRules: StockRulesRoyalGorge,
    companyRules: CompanyRulesRoyalGorge,
    operatingRules: OperatingRulesRoyalGorge,
    trackRules: TrackRulesRoyalGorge,
    stationRules: StationRulesRoyalGorge,
    earningsRules: EarningsRulesRoyalGorge,
    routeRules: RouteRulesRoyalGorge,
    privateRules: PrivateRulesRoyalGorge,
    phases: PhasesRoyalGorge,
    phaseRules: PhaseRulesRoyalGorge,
    trainRules: TrainRulesRoyalGorge,
    decisionHandlers: {
        StockRound: (family) => new StepActionsHandler(family, [BuyMetalSharesStep]),
        OperatingSet: (family) => settlesRounds(family),
        LayingTrack: (family) => new StepActionsHandler(family, [ChooseSteelStep]),
        RunningTrains: (family) =>
            new StepActionsHandler(family, [ExtendTrainStep, UseBridgeLeaseStep]),
        DistributingEarnings: (family) => new StepActionsHandler(family, GoldSteps),
        BuyingTrains: (family) =>
            awaitsBridgeLease(
                new StepActionsHandler(family, [PayBridgeLeaseStep, PayDebtStep, ...GoldSteps])
            )
    },
    actionObservers: {
        OperatingSet: startsTurn,
        RunningTrains(state, action) {
            if (action.type === 'RunTrains' && state.routeStep?.result)
                mineCoal(state, state.routeStep.result.routes)
        }
    },
    titleActions: [
        ...SteelActions,
        ...GoldActions,
        ...ExtensionActions,
        ...DebtActions,
        ...BridgeLeaseActions,
        ...SettlementActions,
        ...MetalPurchaseActions
    ]
}

export const Definition: GameDefinition<StateRoyalGorge, HydratedStateRoyalGorge> = defineGame({
    info: InfoRoyalGorge,
    runtime: createEighteenXXRuntime(TitleRulesRoyalGorge)
})
