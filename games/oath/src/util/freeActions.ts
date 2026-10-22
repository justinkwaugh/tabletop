import { ActionSource, assert, type GameAction } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

export const SECOND_WIND_ID = 'denizen.discord.second-wind'

export function nextActionIndex(state: HydratedOathGameState): number {
    return state.actionCount + 1
}

/** Wild Allies, Captains — for this action only. */
export function campaignAsIfSiteNow(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const asIf = state.getPlayerState(playerId).campaignAsIf
    return asIf && asIf.atAction === state.actionCount ? asIf.siteId : undefined
}

/**
 * R-X.4 — from revision 27 a grant names the card that made it, so its free action records that card; before
 * it, none is named and the free action records none, as games created then were recorded.
 */
export function recordsFreeActionGrants(state: HydratedOathGameState): boolean {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes23)
}

/** Second Wind, Brass Horse — the next action may be a Travel that spends no Supply. */
export function grantFreeTravel(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): void {
    const player = state.getPlayerState(playerId)
    player.freeTravelAtAction = nextActionIndex(state)
    if (recordsFreeActionGrants(state)) player.freeTravelGrantedBy = cardId
}

/** Knights Errant, Hunting Party, Second Wind, Captains, Wild Allies — the next action may be a Campaign that spends no Supply. */
export function grantFreeCampaign(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): void {
    const player = state.getPlayerState(playerId)
    player.freeCampaignAtAction = nextActionIndex(state)
    if (recordsFreeActionGrants(state)) player.freeCampaignGrantedBy = cardId
}

/** The card whose grant makes a Travel taken now free, when the grant names one. */
export function freeTravelNowGrantedBy(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const player = state.getPlayerState(playerId)
    return player.freeTravelAtAction === state.actionCount ? player.freeTravelGrantedBy : undefined
}

/** The card whose grant makes a Campaign taken now free, when the grant names one. */
export function freeCampaignNowGrantedBy(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    const player = state.getPlayerState(playerId)
    return player.freeCampaignAtAction === state.actionCount
        ? player.freeCampaignGrantedBy
        : undefined
}

/** The free Travel is spent or given up, and the card that granted it with it. */
export function clearFreeTravel(state: HydratedOathGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    delete player.freeTravelAtAction
    delete player.freeTravelGrantedBy
}

/** The free Campaign is spent or given up, and the card that granted it with it. */
export function clearFreeCampaign(state: HydratedOathGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    delete player.freeCampaignAtAction
    delete player.freeCampaignGrantedBy
}

export function carryFreeActions(
    state: HydratedOathGameState,
    action: GameAction,
    takenIn: MachineState
): void {
    const index = state.actionCount
    // R-9.4 — letting another peek is not an action of the turn, so it spends no grant.
    const spends = action.type !== ActionType.LetPeek
    for (const player of state.players) {
        if (spends && isOwnActPhaseAction(action, takenIn, player.playerId)) continue
        if (player.freeTravelAtAction === index) player.freeTravelAtAction += 1
        if (player.freeCampaignAtAction === index) player.freeCampaignAtAction += 1
        if (player.campaignAsIf?.atAction === index) player.campaignAsIf.atAction += 1
    }
}

function isOwnActPhaseAction(action: GameAction, takenIn: MachineState, playerId: string) {
    return (
        takenIn === MachineState.ActPhase &&
        action.source === ActionSource.User &&
        action.playerId === playerId
    )
}

function isAhead(state: HydratedOathGameState, actionIndex: number | undefined): boolean {
    return actionIndex !== undefined && actionIndex >= state.actionCount
}

export function hasFreeActionAhead(state: HydratedOathGameState, playerId: string): boolean {
    const player = state.getPlayerState(playerId)
    return isAhead(state, player.freeTravelAtAction) || isAhead(state, player.freeCampaignAtAction)
}

export function forfeitFreeActions(state: HydratedOathGameState, playerId: string): void {
    clearFreeTravel(state, playerId)
    clearFreeCampaign(state, playerId)
}

export function freeActionTypesNow(state: HydratedOathGameState, playerId: string): ActionType[] {
    const player = state.getPlayerState(playerId)
    const types: ActionType[] = []
    if (player.freeTravelAtAction === state.actionCount) types.push(ActionType.Travel)
    if (player.freeCampaignAtAction === state.actionCount) types.push(ActionType.Campaign)
    return types
}

/**
 * An answer is not the free Campaign, so a grant due now passes to the next action, as `carryFreeActions`
 * passes it once the answer is taken; the step it ends can then ask for it.
 */
export function passFreeCampaignToNextAction(state: HydratedOathGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    if (player.freeCampaignAtAction === state.actionCount) {
        player.freeCampaignAtAction = nextActionIndex(state)
    }
}

/** R-10.2 — while a free action is due, only it (or giving it up) may come next. */
export function reasonFreeActionComesFirst(
    state: HydratedOathGameState,
    playerId: string,
    type: ActionType
): string | undefined {
    const due = freeActionTypesNow(state, playerId)
    if (due.length === 0 || due.includes(type)) return undefined
    const names = due.map((due) => (due === ActionType.Travel ? 'Travel' : 'Campaign'))
    return `your free ${names.join(' or ')} comes first: take it or give it up`
}

/** A free action due next that its player cannot take is given up unasked; one granted with it stays due next. */
export function forgoFreeActionNext(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType.Travel | ActionType.Campaign
): void {
    const player = state.getPlayerState(playerId)
    const next = nextActionIndex(state)
    if (action === ActionType.Travel) {
        assert(player.freeTravelAtAction === next, `${playerId} has no free Travel due next`)
        clearFreeTravel(state, playerId)
    } else {
        assert(player.freeCampaignAtAction === next, `${playerId} has no free Campaign due next`)
        clearFreeCampaign(state, playerId)
    }
}

/** Giving up the free Travel leaves a free Campaign granted with it due next. */
export function forgoFreeActionNow(
    state: HydratedOathGameState,
    playerId: string
): ActionType.Travel | ActionType.Campaign {
    const player = state.getPlayerState(playerId)
    if (player.freeTravelAtAction === state.actionCount) {
        clearFreeTravel(state, playerId)
        if (player.freeCampaignAtAction === state.actionCount) {
            player.freeCampaignAtAction = nextActionIndex(state)
        }
        return ActionType.Travel
    }
    assert(player.freeCampaignAtAction === state.actionCount, `${playerId} has no free action due`)
    clearFreeCampaign(state, playerId)
    return ActionType.Campaign
}
