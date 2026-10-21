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
    HydratedStartStockRound,
    StationPlacement,
    getCompany,
    isFinishOperatingTurn,
    isFinishStations,
    isFinishTrack,
    isPlaceStation,
    nextOperatingCompany,
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
import { AssignSteamboatAction, steamboatOwner } from '../steamboat.js'
import { SettleIndependent, SettleIndependentAction } from '../settleIndependent.js'
import { CorporateFinanceAction, corporateFinanceChoices } from '../corporateFinance.js'
import { StationRules1846, stationChoices1846 } from '../stations.js'
import type { HydratedEighteenFortySixState } from '../state.js'

type State = HydratedEighteenFortySixState
type Handler = EighteenXXStateHandler<State>
type Context = MachineContext<State>

/** A wrapper that leaves every family decision alone except the one it overrides. */
function wrapping(family: Handler, overrides: Partial<Handler>): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (id, context) => family.validActionsForPlayer(id, context),
        isValidAction: (action, context) => family.isValidAction(action, context),
        onAction: (action, context) => family.onAction(action, context),
        ...overrides
    }
}
function corporateFinanceActions(playerId: string, state: State): string[] {
    return state.isActivePlayer(playerId) && corporateFinanceChoices(state).length
        ? ['CorporateFinance']
        : []
}
function resumingOpeningPurchases(state: State): boolean {
    return (
        state.draft?.kind === 'public' &&
        state.draft.stage === 'operating' &&
        canStartStockRound(state)
    )
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

/** Zero-price corporations close before trading. */
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
                : family.validActionsForPlayer(playerId, context),
        isValidAction(action, context) {
            return corporationAwaitingClosure(context.gameState)
                ? corporationClosureHandler.isValidAction(action, context)
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
 * Between companies: the Steamboat is assigned as a round starts, and the two-player opening
 * resumes its purchases after the preliminary set.
 */
export function operatingSet1846(family: Handler): Handler {
    return {
        enter(context) {
            if (resumingOpeningPurchases(context.gameState))
                context.addSystemAction(ResumeOpeningPurchases)
            else family.enter(context)
        },
        validActionsForPlayer: (playerId, context) =>
            family.validActionsForPlayer(playerId, context),
        isValidAction(action, context) {
            if (action instanceof ResumeOpeningPurchasesAction)
                return action.isValid(context.gameState)
            return family.isValidAction(action, context)
        },
        onAction(action, context) {
            const state = context.gameState
            if (
                action instanceof HydratedStartOperatingTurn ||
                action instanceof HydratedStartOperatingRound ||
                action instanceof HydratedStartStockRound
            )
                delete state.acquiredTrainIds
            if (action instanceof ResumeOpeningPurchasesAction) return 'BuyingOpeningCompanies'
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
    return wrapping(family, {
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
    })
}

export function distributingEarnings1846(family: Handler): Handler {
    return wrapping(family, {
        onAction(_action, { gameState }) {
            return corporationAwaitingClosure(gameState)
                ? 'ClosingOperatingCorporation'
                : 'BuyingTrains'
        }
    })
}

export function buyingTrains1846(family: Handler): Handler {
    return wrapping(family, {
        onAction(action, context) {
            const next = family.onAction(action, context)
            if (isFinishOperatingTurn(action)) context.gameState.activePlayerIds = []
            return next
        }
    })
}

/** A corporation whose price falls to zero during funding closes before funding goes on. */
export function fundingTrain1846(family: Handler): Handler {
    return {
        enter(context) {
            const companyId = corporationAwaitingClosure(context.gameState)
            if (companyId) context.addSystemAction(CloseCorporation, { companyId })
            else family.enter(context)
        },
        validActionsForPlayer: (id, context) =>
            corporationAwaitingClosure(context.gameState)
                ? []
                : family.validActionsForPlayer(id, context),
        isValidAction: (action, context) =>
            corporationAwaitingClosure(context.gameState)
                ? corporationClosureHandler.isValidAction(action, context)
                : family.isValidAction(action, context),
        onAction: (action, context) =>
            action instanceof CloseCorporationAction
                ? 'FundingTrain'
                : family.onAction(action, context)
    }
}

export const closingOperatingCorporationHandler: Handler = {
    ...corporationClosureHandler,
    onAction(action: HydratedAction, { gameState }: Context) {
        assert(action instanceof CloseCorporationAction, 'Closure requires its system action')
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
