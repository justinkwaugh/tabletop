import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    StepActionsHandler,
    SystemActionFirstHandler,
    clearsOnLeaving,
    createEighteenXXRuntime,
    isStartOperatingRound,
    isStartStockRound,
    isStartOperatingTurn,
    getCompany,
    hasTurnMark,
    settleCashPayments,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    AcquireMinorStep,
    AcquiredMark,
    AcquisitionActions,
    awaitsAcquisitionAnswer
} from '../acquisition.js'
import {
    ReachDestination,
    ReachDestinationDefinition,
    destinationDue1822
} from '../destinations.js'
import { HousekeepingActions, HousekeepingSteps, metropolitanHomeDue1822 } from '../housekeeping.js'
import { refillBidBoxes1822 } from '../lots.js'
import { Names1822 } from '../names.js'
import { createOpening1822, startingCash1822 } from '../opening.js'
import {
    CorporateFinanceRules1822,
    EarningsRules1822,
    EndingRules1822,
    OperatingRules1822,
    PhaseRules1822,
    PrivateRules1822,
    TrainFundingRules1822,
    TrainRules1822,
    TransferRules1822,
    phaseCreditPayments1822
} from '../operating.js'
import {
    AcquirePrivateStep,
    PrivateAcquisitionActions,
    awaitsPrivateAnswer
} from '../privateAcquisition.js'
import {
    PrivatePowerActions,
    PrivatePowerRules1822,
    PrivatePowerSteps,
    closeSpentTrackPowers1822
} from '../privatePowers.js'
import { RepayPlayerLoanStep, StockTurnActions, declaresCash } from '../stockTurn.js'
import { RouteRules1822 } from '../routes.js'
import {
    State1822,
    StateDefinition1822,
    type HydratedState1822,
    type StateHandler1822
} from '../state.js'
import { StationRules1822 } from '../stations.js'
import { BidBoxRules1822, CompanyRules1822, StockRules1822 } from '../stock.js'
import { TrackRules1822 } from '../track.js'
import { Phases1822 } from '../trains.js'
import { Info1822 } from './info.js'

/**
 * As each operating round begins, phase-credit privates set their income aside, and a company on
 * its first turn is noted for the round (§5.18.1, Table 3). As a stock round begins, the bidding
 * boxes close their gaps and fill from the stacks (§4.5.2).
 */
const tracksRounds = (handler: StateHandler1822): StateHandler1822 => ({
    enter: (context) => handler.enter(context),
    isValidAction: (action, context) => handler.isValidAction(action, context),
    validActionsForPlayer: (playerId, context) => handler.validActionsForPlayer(playerId, context),
    onAction(action, context) {
        const next = handler.onAction(action, context)
        const state = context.gameState
        if (isStartStockRound(action)) refillBidBoxes1822(state)
        if (isStartOperatingRound(action)) {
            state.debutCompanyIds = []
            settleCashPayments(state, phaseCreditPayments1822(state))
        }
        if (isStartOperatingTurn(action) && !getCompany(state, action.companyId).operated)
            state.debutCompanyIds = [...state.debutCompanyIds, action.companyId]
        return next
    }
})

/** After its track, a major company joined to its destination places its destination token (§5.11.1). */
const reachesDestination = (handler: StateHandler1822): StateHandler1822 =>
    new SystemActionFirstHandler(handler, ReachDestination, destinationDue1822)

/** The Metropolitan Railway places its home before it does anything else in its first turn (§5.6.7). */
const placesMetropolitanHome = (handler: StateHandler1822): StateHandler1822 => ({
    enter: (context) => handler.enter(context),
    isValidAction: (action, context) =>
        (!metropolitanHomeDue1822(context.gameState) || action.type === 'PlaceMetropolitanHome') &&
        handler.isValidAction(action, context),
    validActionsForPlayer: (playerId, context) => {
        const actions = handler.validActionsForPlayer(playerId, context)
        return metropolitanHomeDue1822(context.gameState)
            ? actions.filter((type) => type === 'PlaceMetropolitanHome')
            : actions
    },
    onAction: (action, context) => handler.onAction(action, context)
})

/** A major company that has acquired a minor buys no more trains that turn (§5.3.1). */
const closesTrainsAfterAcquisition = (handler: StateHandler1822): StateHandler1822 => {
    const acquired = (state: HydratedState1822) => hasTurnMark(state, AcquiredMark)
    const buysTrain = (type: string) => type === 'BuyTrain' || type === 'FundTrain'
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) =>
            !(acquired(context.gameState) && buysTrain(action.type)) &&
            handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) => {
            const actions = handler.validActionsForPlayer(playerId, context)
            return acquired(context.gameState)
                ? actions.filter((type) => !buysTrain(type))
                : actions
        },
        onAction: (action, context) => handler.onAction(action, context)
    }
}

const TrackStepTypes = [...HousekeepingSteps, AcquirePrivateStep, ...PrivatePowerSteps].map(
    (step) => step.type
)

export const TitleRules1822: EighteenXXTitleRules<typeof State1822, HydratedState1822> = {
    state: StateDefinition1822,
    endingRules: EndingRules1822,
    names: Names1822,
    createOpening: createOpening1822,
    startingCash: startingCash1822,
    currencySymbol: '£',
    stockRules: StockRules1822,
    bidBoxRules: BidBoxRules1822,
    companyRules: CompanyRules1822,
    operatingRules: OperatingRules1822,
    trackRules: TrackRules1822,
    stationRules: StationRules1822,
    earningsRules: EarningsRules1822,
    routeRules: RouteRules1822,
    trainRules: TrainRules1822,
    trainFundingRules: TrainFundingRules1822,
    phases: Phases1822,
    phaseRules: PhaseRules1822,
    privateRules: PrivateRules1822,
    privatePowerRules: PrivatePowerRules1822,
    transferRules: TransferRules1822,
    corporateFinanceRules: CorporateFinanceRules1822,
    additionalConstructionActions: TrackStepTypes,
    decisionHandlers: {
        StockRound: (family) => declaresCash(new StepActionsHandler(family, [RepayPlayerLoanStep])),
        OperatingSet: tracksRounds,
        LayingTrack: (family) =>
            clearsOnLeaving(
                awaitsPrivateAnswer(
                    placesMetropolitanHome(
                        new StepActionsHandler(family, [
                            ...HousekeepingSteps,
                            AcquirePrivateStep,
                            ...PrivatePowerSteps
                        ])
                    )
                ),
                'LayingTrack',
                closeSpentTrackPowers1822
            ),
        PlacingStation: reachesDestination,
        BuyingTrains: (family) =>
            awaitsAcquisitionAnswer(
                closesTrainsAfterAcquisition(new StepActionsHandler(family, [AcquireMinorStep]))
            )
    },
    titleActions: [
        ReachDestinationDefinition,
        ...HousekeepingActions,
        ...PrivateAcquisitionActions,
        ...PrivatePowerActions,
        ...AcquisitionActions,
        ...StockTurnActions
    ]
}

export const Definition: GameDefinition<State1822, HydratedState1822> = defineGame({
    info: Info1822,
    runtime: createEighteenXXRuntime(TitleRules1822)
})
