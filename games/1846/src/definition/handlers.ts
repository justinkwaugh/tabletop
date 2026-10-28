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
import { AssignSteamboatAction, steamboatOwner } from '../steamboat.js'
import { SettleIndependent, SettleIndependentAction } from '../settleIndependent.js'
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

export function runningTrains1846(family: Handler): Handler {
    return wrapping(family, {
        onAction(action, context) {
            if (family.onAction(action, context) === 'RunningTrains') return 'RunningTrains'
            const { gameState } = context
            const companyId = gameState.routeStep?.companyId
            assertExists(companyId, 'A train run requires an operating company')
            if (trainsRustingAfterOperation(gameState, companyId).length) return 'RustingTrains'
            return getCompany(gameState, companyId).kind === 'minor'
                ? 'SettlingIndependent'
                : 'DistributingEarnings'
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
