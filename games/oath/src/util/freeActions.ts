import { ActionSource, assert, type GameAction } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

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
    const player = state.getPlayerState(playerId)
    delete player.freeTravelAtAction
    delete player.freeCampaignAtAction
}

export function freeActionTypesNow(state: HydratedOathGameState, playerId: string): ActionType[] {
    const player = state.getPlayerState(playerId)
    const types: ActionType[] = []
    if (player.freeTravelAtAction === state.actionCount) types.push(ActionType.Travel)
    if (player.freeCampaignAtAction === state.actionCount) types.push(ActionType.Campaign)
    return types
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

/** Giving up the free Travel leaves a free Campaign granted with it due next. */
export function forgoFreeActionNow(
    state: HydratedOathGameState,
    playerId: string
): ActionType.Travel | ActionType.Campaign {
    const player = state.getPlayerState(playerId)
    if (player.freeTravelAtAction === state.actionCount) {
        delete player.freeTravelAtAction
        if (player.freeCampaignAtAction === state.actionCount) {
            player.freeCampaignAtAction = nextActionIndex(state)
        }
        return ActionType.Travel
    }
    assert(player.freeCampaignAtAction === state.actionCount, `${playerId} has no free action due`)
    delete player.freeCampaignAtAction
    return ActionType.Campaign
}
