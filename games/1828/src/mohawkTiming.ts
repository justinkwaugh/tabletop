import {
    floatedCompaniesInMarketOrder,
    hasTurnMark,
    isChooseHomeStation,
    isPlaceHomeStations,
    markTurn,
    nextOperatingCompany,
    reorderPendingOperatingCompanies,
    type OperatingState
} from '@tabletop/18xx'
import { cobourgOperates } from './cobourg.js'
import { CobourgRailwayId } from './ids.js'
import type { HydratedState1828, StateHandler1828 } from './state.js'
import { Market1828 } from './stockMarket.js'

const HomePlacedMark = 'home-station-placed'

/** The operating order: a player's C&P as the privates pay, then companies by price (§8.1, §8.2). */
export function operatingOrder1828(state: OperatingState): string[] {
    return [
        ...(cobourgOperates(state) ? [CobourgRailwayId] : []),
        ...floatedCompaniesInMarketOrder(Market1828, state)
    ]
}

/** A share company's home station placed as its turn opens is the first thing it does. */
export function notesHomeStations(handler: StateHandler1828): StateHandler1828 {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            const state = context.gameState
            if (
                (isPlaceHomeStations(action) || isChooseHomeStation(action)) &&
                nextOperatingCompany(state) !== CobourgRailwayId
            )
                markTurn(state, HomePlacedMark)
            return handler.onAction(action, context)
        }
    }
}

/**
 * Whether no share company has yet operated this operating round (§13.2.2.6). The first takes its
 * turn from its first action, a home station included; `exchanging` counts the exchange and
 * flotation already recorded since the turn opened.
 */
export function noShareCompanyHasOperated(state: HydratedState1828, exchanging = 0): boolean {
    const set = state.operatingSet
    if (!set || set.completed || !set.privateIncomePaid) return false
    if (set.completedCompanyIds.some((companyId) => companyId !== CobourgRailwayId)) return false
    if (nextOperatingCompany(state) === CobourgRailwayId) return true
    if (hasTurnMark(state, HomePlacedMark)) return false
    const turn = state.turnManager.currentTurn()
    return !!turn && state.actionCount <= turn.start + exchanging
}

/**
 * A company the M&H floats during an operating round takes its place in that round while no share
 * company has operated, and otherwise waits for the next (§13.2.2.6).
 */
export function admitMohawkFloat(state: HydratedState1828): void {
    if (state.machineState === 'StockRound' || !noShareCompanyHasOperated(state, 1)) return
    reorderPendingOperatingCompanies(state, operatingOrder1828(state), {
        betweenCompanies: true,
        admitsLaterCompanies: true
    })
}
