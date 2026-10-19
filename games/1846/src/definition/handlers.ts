import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    FinishStations,
    HydratedStartOperatingRound,
    HydratedStartOperatingTurn,
    StationPlacement,
    endOperatingTurn,
    getCompany,
    isFinishOperatingTurn,
    isFinishStations,
    isFinishTrack,
    isPlaceStation,
    nextOperatingCompany,
    canStartOperatingRound,
    canStartStockRound,
    trainsRustingAfterOperation,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import { ChooseAction, PassAction, RevealAction, RevealDraft } from '../actions.js'
import { choicesFor, draftExhausted, hiddenDistribution } from '../distribution.js'
import { ResumeOpeningPurchases, ResumeOpeningPurchasesAction } from '../publicDistribution.js'
import {
    CloseCorporation,
    CloseCorporationAction,
    corporationAwaitingClosure,
    corporationClosureHandler
} from '../closeCorporation.js'
import { BuyReceiverShareAction, receiverShareChoices } from '../receiverShares.js'
import { StartReceiverTurn, StartReceiverTurnAction } from '../receiverOperations.js'
import { inReceivership } from '../receivership.js'
import { AssignSteamboatAction, steamboatOwner } from '../steamboat.js'
import { SettleIndependent, SettleIndependentAction } from '../settleIndependent.js'
import { CorporateFinanceAction, corporateFinanceChoices } from '../corporateFinance.js'
import { StationRules1846, stationChoices1846 } from '../stations.js'
import {
    EmergencyBuyTrainAction,
    StartEmergencyFundingAction,
    emergencyFundingStart,
    emergencyTrainChoices
} from '../emergencyTrain.js'
import { SellEmergencySharesAction, emergencyShareSaleChoices } from '../emergencyFunding.js'
import { DeclareBankruptcyAction, bankruptcyShortfall } from '../bankruptcy.js'
import type { HydratedEighteenFortySixState } from '../state.js'

type State = HydratedEighteenFortySixState
type Handler = EighteenXXStateHandler<State>
type Context = MachineContext<State>

function corporateFinanceActions(playerId: string, state: State): string[] {
    return state.isActivePlayer(playerId) && corporateFinanceChoices(state).length
        ? ['CorporateFinance']
        : []
}
function resumingOpeningPurchases(state: State): boolean {
    return (
        state.draft.kind === 'public' &&
        state.draft.stage === 'operating' &&
        canStartStockRound(state)
    )
}
/** The next company to operate when it is in receivership and its turn can begin. */
function receiverTurnCompany(state: State): string | undefined {
    const companyId = nextOperatingCompany(state)
    return companyId &&
        state.operatingSet?.privateIncomePaid &&
        !canStartOperatingRound(state) &&
        inReceivership(state, companyId)
        ? companyId
        : undefined
}

export const draftingHandler: Handler = {
    enter() {},
    validActionsForPlayer(playerId, { gameState }) {
        if (!gameState.isActivePlayer(playerId)) return []
        return [
            ...(choicesFor(gameState, playerId).length ? ['ChooseDraftCard'] : []),
            ...(hiddenDistribution(gameState).finalOffer ? ['PassFinalCompany'] : [])
        ]
    },
    isValidAction(action, { gameState }) {
        return (
            (action instanceof ChooseAction &&
                choicesFor(gameState, action.playerId).includes(action.cardId)) ||
            (action instanceof PassAction &&
                gameState.isActivePlayer(action.playerId) &&
                hiddenDistribution(gameState).finalOffer !== undefined)
        )
    },
    onAction(_action, { gameState }) {
        return draftExhausted(gameState) ? 'RevealingDraft' : 'Drafting'
    }
}
export const revealingDraftHandler: Handler = {
    enter(context) {
        context.addSystemAction(RevealDraft)
    },
    validActionsForPlayer() {
        return []
    },
    isValidAction(action) {
        return action instanceof RevealAction
    },
    onAction() {
        return 'StockRound'
    }
}

/** Zero-price corporations close before trading, and receivers' shares may be bought. */
export function stockRound1846(family: Handler): Handler {
    return {
        enter(context) {
            const companyId = corporationAwaitingClosure(context.gameState)
            if (companyId) context.addSystemAction(CloseCorporation, { companyId })
            else family.enter(context)
        },
        validActionsForPlayer: (playerId, context) =>
            corporationAwaitingClosure(context.gameState)
                ? []
                : [
                      ...family.validActionsForPlayer(playerId, context),
                      ...(receiverShareChoices(context.gameState, playerId).length
                          ? ['BuyReceiverShare']
                          : [])
                  ],
        isValidAction(action, context) {
            const companyId = corporationAwaitingClosure(context.gameState)
            return companyId
                ? corporationClosureHandler.isValidAction(action, context)
                : action instanceof BuyReceiverShareAction
                  ? action.isValid(context.gameState)
                  : family.isValidAction(action, context)
        },
        onAction(_action, context) {
            if (
                context.gameState.stockRound.completed &&
                !corporationAwaitingClosure(context.gameState)
            ) {
                context.gameState.activePlayerIds = []
                return 'StartingOperatingSet'
            }
            return 'StockRound'
        }
    }
}

/**
 * Between companies: the Steamboat is assigned as a round starts, receivers operate their
 * railroads, and the two-player opening resumes its purchases after the preliminary set.
 */
export function operatingSet1846(family: Handler): Handler {
    return {
        enter(context) {
            const state = context.gameState
            if (resumingOpeningPurchases(state)) {
                context.addSystemAction(ResumeOpeningPurchases)
                return
            }
            const companyId = receiverTurnCompany(state)
            if (companyId) context.addSystemAction(StartReceiverTurn, { companyId })
            else family.enter(context)
        },
        validActionsForPlayer: (playerId, context) =>
            family.validActionsForPlayer(playerId, context),
        isValidAction(action, context) {
            const state = context.gameState
            if (action instanceof ResumeOpeningPurchasesAction) return action.isValid(state)
            if (action instanceof StartReceiverTurnAction)
                return (
                    action.source === ActionSource.System &&
                    action.companyId === receiverTurnCompany(state)
                )
            return family.isValidAction(action, context)
        },
        onAction(action, context) {
            const state = context.gameState
            if (action instanceof ResumeOpeningPurchasesAction) return 'BuyingOpeningCompanies'
            if (action instanceof StartReceiverTurnAction) return 'RunningReceiver'
            if (action instanceof HydratedStartOperatingRound && steamboatOwner(state))
                return 'AssigningSteamboat'
            if (action instanceof HydratedStartOperatingTurn) delete state.financeStep
            return family.onAction(action, context)
        }
    }
}

export const assigningSteamboatHandler: Handler = {
    enter({ gameState }) {
        const owner = steamboatOwner(gameState)
        assertExists(owner, 'Steamboat assignment requires its player owner')
        gameState.activePlayerIds = [owner]
    },
    validActionsForPlayer(playerId, { gameState }) {
        return gameState.isActivePlayer(playerId) ? ['AssignSteamboat'] : []
    },
    isValidAction(action, { gameState }) {
        return action instanceof AssignSteamboatAction && action.isValid(gameState)
    },
    onAction() {
        return 'OperatingSet'
    }
}

/** Track and stations are one step, beside issuing or redeeming shares. */
export function layingTrack1846(family: Handler): Handler {
    return {
        enter(context) {
            family.enter(context)
            const state = context.gameState
            const companyId = state.trackStep?.companyId
            assertExists(companyId, 'Construction requires an operating company')
            if (getCompany(state, companyId).kind !== 'major') return
            state.stationStep ??= { companyId, placedStationIds: [], completed: false }
            if (state.trackStep?.completed)
                context.addSystemAction(FinishStations, {
                    companyId,
                    playerId: state.activePlayerIds[0]
                })
        },
        validActionsForPlayer(id, context) {
            return [
                ...family.validActionsForPlayer(id, context),
                ...(context.gameState.isActivePlayer(id) &&
                stationChoices1846(context.gameState).length
                    ? ['PlaceStation']
                    : []),
                ...corporateFinanceActions(id, context.gameState)
            ]
        },
        isValidAction(action, context) {
            const state = context.gameState
            if (action instanceof CorporateFinanceAction) return action.isValid(state)
            if (isFinishStations(action))
                return (
                    action.source === ActionSource.System &&
                    !!state.trackStep?.completed &&
                    state.stationStep?.companyId === action.companyId &&
                    !state.stationStep.completed &&
                    state.isActivePlayer(action.playerId)
                )
            if (!isPlaceStation(action)) return family.isValidAction(action, context)
            const placement = new StationPlacement(state, StationRules1846)
            return (
                action.source === ActionSource.User &&
                state.isActivePlayer(action.playerId) &&
                placement.canAct(action.playerId, action.companyId) &&
                placement.evaluate(action).details?.cost === action.expectedCost
            )
        },
        onAction(action, { gameState }) {
            if (isFinishStations(action)) return 'RunningTrains'
            if (isFinishTrack(action) && !gameState.stationStep) return 'RunningTrains'
            return 'LayingTrack'
        }
    }
}

export function runningTrains1846(family: Handler): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (id, context) => [
            ...family.validActionsForPlayer(id, context),
            ...corporateFinanceActions(id, context.gameState)
        ],
        isValidAction: (action, context) =>
            action instanceof CorporateFinanceAction
                ? action.isValid(context.gameState)
                : family.isValidAction(action, context),
        onAction(action, { gameState }) {
            if (action instanceof CorporateFinanceAction) return 'RunningTrains'
            const companyId = gameState.routeStep?.companyId
            assertExists(companyId, 'A train run requires an operating company')
            if (trainsRustingAfterOperation(gameState, companyId).length) return 'RustingTrains'
            return getCompany(gameState, companyId).kind === 'minor'
                ? 'SettlingIndependent'
                : 'DistributingEarnings'
        }
    }
}

export function distributingEarnings1846(family: Handler): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (id, context) => family.validActionsForPlayer(id, context),
        isValidAction: (action, context) => family.isValidAction(action, context),
        onAction(_action, { gameState }) {
            return corporationAwaitingClosure(gameState)
                ? 'ClosingOperatingCorporation'
                : 'BuyingTrains'
        }
    }
}

export function buyingTrains1846(family: Handler): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (id, context) => [
            ...family.validActionsForPlayer(id, context),
            ...(context.gameState.activePlayerIds.includes(id) &&
            emergencyTrainChoices(context.gameState).length
                ? ['EmergencyBuyTrain']
                : []),
            ...(context.gameState.activePlayerIds.includes(id) &&
            emergencyFundingStart(context.gameState)
                ? ['StartEmergencyFunding']
                : [])
        ],
        isValidAction: (action, context) =>
            action instanceof EmergencyBuyTrainAction ||
            action instanceof StartEmergencyFundingAction
                ? action.isValid(context.gameState)
                : family.isValidAction(action, context),
        onAction(action, { gameState }) {
            if (gameState.emergencyFunding) return 'FundingTrain'
            if (gameState.phaseChange) return 'AdvancingPhase'
            if (!isFinishOperatingTurn(action)) return 'BuyingTrains'
            gameState.activePlayerIds = []
            return 'OperatingSet'
        }
    }
}

export function rustingTrains1846(family: Handler): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: () => [],
        isValidAction: (action, context) => family.isValidAction(action, context),
        onAction(_action, { gameState }) {
            const companyId = gameState.routeStep?.companyId
            assertExists(companyId, 'Rusting requires an operating company')
            return inReceivership(gameState, companyId)
                ? 'SettlingReceiver'
                : 'DistributingEarnings'
        }
    }
}

export const closingOperatingCorporationHandler: Handler = {
    ...corporationClosureHandler,
    onAction(action: HydratedAction, { gameState }: Context) {
        assert(action instanceof CloseCorporationAction, 'Closure requires its system action')
        endOperatingTurn(gameState, action.companyId)
        gameState.activePlayerIds = []
        return 'OperatingSet'
    }
}

export const settlingIndependentHandler: Handler = {
    enter(context) {
        const companyId = nextOperatingCompany(context.gameState)
        assertExists(companyId, 'Settlement requires an independent')
        context.addSystemAction(SettleIndependent, { companyId })
    },
    validActionsForPlayer() {
        return []
    },
    isValidAction(action, { gameState }) {
        return (
            action instanceof SettleIndependentAction &&
            action.source === ActionSource.System &&
            action.companyId === nextOperatingCompany(gameState)
        )
    },
    onAction() {
        return 'OperatingSet'
    }
}

export const fundingTrainHandler: Handler = {
    enter() {},
    validActionsForPlayer(id, { gameState }) {
        if (!gameState.activePlayerIds.includes(id)) return []
        return [
            ...(bankruptcyShortfall(gameState) !== undefined ? ['DeclareBankruptcy1846'] : []),
            ...(emergencyTrainChoices(gameState).length ? ['EmergencyBuyTrain'] : []),
            ...(emergencyShareSaleChoices(gameState).length ? ['SellEmergencyShares'] : [])
        ]
    },
    isValidAction(action, { gameState }) {
        return (
            (action instanceof EmergencyBuyTrainAction ||
                action instanceof SellEmergencySharesAction ||
                action instanceof DeclareBankruptcyAction) &&
            action.isValid(gameState)
        )
    },
    onAction(_action, { gameState }) {
        if (gameState.result) return 'GameOver'
        if (
            !gameState.emergencyFunding &&
            gameState.trainPurchaseStep &&
            inReceivership(gameState, gameState.trainPurchaseStep.companyId)
        )
            return 'BuyingReceiverTrain'
        if (corporationAwaitingClosure(gameState)) return 'ClosingFundingCorporation'
        if (gameState.phaseChange) return 'AdvancingPhase'
        return gameState.emergencyFunding ? 'FundingTrain' : 'BuyingTrains'
    }
}

export const closingFundingCorporationHandler: Handler = {
    ...corporationClosureHandler,
    onAction(_action: HydratedAction, { gameState }: Context) {
        return corporationAwaitingClosure(gameState) ? 'ClosingFundingCorporation' : 'FundingTrain'
    }
}
