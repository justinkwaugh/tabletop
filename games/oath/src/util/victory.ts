import { assert } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathType, PlayerStatus } from '../model/oathEnums.js'
import {
    citizensMeetingSuccessorGoal,
    meetsRevealedVisionGoal,
    revealedVisionGoal,
    visionsMetBy
} from './oathkeeper.js'
import { isImperialPlayer } from './rule.js'
import { GOAL_VISION_IDS } from '../data/visions.js'

/** R-3 — pure: R-3.3's die is rolled by the caller in `apply()` from the protected stream. */

export enum WinKind {
    /** R-3.1 */
    Usurper = 'usurper',
    /** R-3.2 */
    Visionary = 'visionary',
    /** R-3.3 */
    StableRegime = 'stableRegime',
    /** R-3.3.1 */
    Successor = 'successor',
    /** R-3.4 */
    WarExhaustion = 'warExhaustion'
}

/** R-3.4 has its own four steps, and R-3.3.1 fires under R-3.3, R-3.4.1 or R-3.4.4. */
export const WIN_RULES = [
    'R-3.1',
    'R-3.2',
    'R-3.3',
    'R-3.3.1',
    'R-3.4.1',
    'R-3.4.2',
    'R-3.4.3',
    'R-3.4.4'
] as const

export type WinRule = (typeof WIN_RULES)[number]

export interface GameOutcome {
    winnerPlayerId: string
    kind: WinKind
    rule: WinRule
}

/** R-3.3 — "6 (end of 5th); 5-6 (6th); 3-6 (7th)"; the eighth is R-3.4's. */
export function endDieThreshold(round: number): number | undefined {
    switch (round) {
        case 5:
            return 6
        case 6:
            return 5
        case 7:
            return 3
        default:
            return undefined
    }
}

/** R-3.3 — "if the Chancellor or a Citizen is the Oathkeeper". */
export function endDieIsRolled(state: HydratedOathGameState): boolean {
    if (endDieThreshold(state.round) === undefined) return false

    const holderId = state.oathkeeperPlayerId
    if (!holderId) return false
    return isImperialPlayer(state, holderId)
}

/** R-3.3.1 — wherever "the Chancellor would win"; at most one Citizen qualifies. */
function empireWinner(state: HydratedOathGameState, kind: WinKind, rule: WinRule): GameOutcome {
    const successors = citizensMeetingSuccessorGoal(state)
    assert(
        successors.length <= 1,
        `R-3.3.1 admits at most one Successor, found ${successors.length}: ${successors.join(', ')}`
    )
    if (successors.length === 1) {
        return { winnerPlayerId: successors[0], kind: WinKind.Successor, rule: 'R-3.3.1' }
    }
    return { winnerPlayerId: state.chancellorId(), kind, rule }
}

/** R-3.3, R-3.3.1 */
export function stableRegimeWinner(
    state: HydratedOathGameState,
    roll: number
): GameOutcome | undefined {
    const threshold = endDieThreshold(state.round)
    if (threshold === undefined || !endDieIsRolled(state)) return undefined
    if (roll < threshold) return undefined
    return empireWinner(state, WinKind.StableRegime, 'R-3.3')
}

/** R-3.4 */
export function warExhaustionWinner(state: HydratedOathGameState): GameOutcome {
    // R-3.4.1 — the Empire holds the title.
    const holderId = state.oathkeeperPlayerId
    const holderStatus = holderId ? state.getPlayerState(holderId).status : undefined
    if (holderId && isImperialPlayer(state, holderId)) {
        return empireWinner(state, WinKind.WarExhaustion, 'R-3.4.1')
    }

    // R-3.4.2 — only one player holds the title, so "any Exile" names at most one.
    if (holderId && holderStatus === PlayerStatus.Exile && state.oathkeeperIsUsurper) {
        return { winnerPlayerId: holderId, kind: WinKind.Usurper, rule: 'R-3.4.2' }
    }

    // R-3.4.3 — ties broken by the printed Vision order.
    const visionaries = state.players
        .filter(
            (player) =>
                player.status === PlayerStatus.Exile &&
                meetsRevealedVisionGoal(state, player.playerId)
        )
        .map((player) => player.playerId)

    if (visionaries.length > 0) {
        const ranked = [...visionaries].sort((a, b) => {
            const rank = (id: string) =>
                Math.min(
                    ...visionsMetBy(state, id).map((visionId) => GOAL_VISION_IDS.indexOf(visionId))
                )
            return rank(a) - rank(b)
        })
        return {
            winnerPlayerId: ranked[0],
            kind: WinKind.Visionary,
            rule: 'R-3.4.3'
        }
    }

    // R-3.4.4
    return empireWinner(state, WinKind.WarExhaustion, 'R-3.4.4')
}

/** R-4.1.2 — R-3.1 then R-3.2, before R-4.1.3 flips the title. */
export function wakePhaseWin(
    state: HydratedOathGameState,
    playerId: string
): GameOutcome | undefined {
    const player = state.getPlayerState(playerId)
    if (player.status !== PlayerStatus.Exile) return undefined

    if (state.oathkeeperPlayerId === playerId && state.oathkeeperIsUsurper) {
        return { winnerPlayerId: playerId, kind: WinKind.Usurper, rule: 'R-3.1' }
    }

    if (meetsRevealedVisionGoal(state, playerId)) {
        return { winnerPlayerId: playerId, kind: WinKind.Visionary, rule: 'R-3.2' }
    }

    return undefined
}

export function oathTypeName(oathType: OathType): string {
    switch (oathType) {
        case OathType.Supremacy:
            return 'the Oath of Supremacy'
        case OathType.ThePeople:
            return 'the Oath of the People'
        case OathType.Protection:
            return 'the Oath of Protection'
        case OathType.Devotion:
            return 'the Oath of Devotion'
    }
}

export { revealedVisionGoal }
