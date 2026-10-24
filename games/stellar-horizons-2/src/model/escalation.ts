import * as Type from 'typebox'
import { EscalationMarker, escalationPoints } from '../components/escalation.js'
import { isCampaign } from './campaign.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { EscalationDraw } from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'
import { drawFromPool } from './pools.js'
import { DECADE } from './turnCycle.js'

// Rulebook 1.7. Military Academy draws one more each time and discards one of those drawn; its
// extra marker never costs IP when the pool runs dry.
export function drawEscalation(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    owed: number
): EscalationDraw {
    const player = state.getPlayerState(playerId)
    const extra = owed > 0 ? capabilitiesOf(state, playerId).extraEscalation : 0
    const drawn = drawFromPool(state, state.escalationPool, owed + extra)
    player.escalation.push(...drawn)
    if (drawn.length > owed) {
        state.escalationDiscard = { playerId, drawn: [...drawn] }
    }
    const short = Math.max(0, owed - drawn.length)
    const influenceLost = Math.min(short, player.influence)
    player.influence -= influenceLost
    const banned = influenceLost < short
    if (banned) {
        player.attackBanned = true
    }
    return { playerId, owed, drawn, influenceLost, banned }
}

export function discardDrawnEscalation(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    marker: EscalationMarker
) {
    const pending = state.escalationDiscard
    if (pending?.playerId !== playerId || !pending.drawn.includes(marker)) {
        throw Error(`${marker} is not among the markers ${playerId} drew`)
    }
    const player = state.getPlayerState(playerId)
    player.escalation.splice(player.escalation.indexOf(marker), 1)
    state.escalationPool.push(marker)
    state.escalationDiscard = undefined
}

// Rulebook 3.0 and 1.7: nobody attacks during the truce, while holding You Can't Attack, or
// after an empty pool left them short of IP. A blockade counts as an attack (campaign plan,
// slice 5, Q5).
export function canAttack(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
    return (
        isCampaign(state) &&
        !state.truce &&
        !state.getPlayerState(playerId).attackBanned &&
        !capabilitiesOf(state, playerId).attacksForbidden
    )
}

// Rulebook 4.1: half the markers are discarded, rounded up, so a single marker always goes.
export function escalationKeepCount(held: number): number {
    return Math.floor(held / 2)
}

// The Player chooses which to keep only when it can make a difference.
export function choosesEscalationKept(player: HydratedStellarHorizonsPlayerState): boolean {
    return escalationKeepCount(player.escalation.length) > 0 && new Set(player.escalation).size > 1
}

// Which of the held markers a kept list keeps, each kept marker matching one held marker of its
// kind, in order.
export function keptMask(
    held: readonly EscalationMarker[],
    kept: readonly EscalationMarker[]
): boolean[] {
    const spare = [...kept]
    return held.map((marker) => {
        const index = spare.indexOf(marker)
        if (index < 0) {
            return false
        }
        spare.splice(index, 1)
        return true
    })
}

export function isValidEscalationKept(
    player: HydratedStellarHorizonsPlayerState,
    kept: readonly EscalationMarker[]
): boolean {
    const keeps = keptMask(player.escalation, kept).filter(Boolean).length
    return keeps === kept.length && kept.length === escalationKeepCount(player.escalation.length)
}

export type EscalationDiscards = Type.Static<typeof EscalationDiscards>
export const EscalationDiscards = Type.Object({
    playerId: Type.String(),
    discarded: Type.Array(Type.Enum(EscalationMarker))
})

// After the initiative rolls each Player keeps what they chose; without a choice to make, the
// first markers are kept. The ban from an empty pool lifts.
export function discardEscalation(state: HydratedStellarHorizonsGameState): EscalationDiscards[] {
    return state.initiativeOrder().flatMap((playerId) => {
        const player = state.getPlayerState(playerId)
        player.attackBanned = false
        const kept =
            player.escalationKept ??
            player.escalation.slice(0, escalationKeepCount(player.escalation.length))
        player.escalationKept = undefined
        const mask = keptMask(player.escalation, kept)
        const discarded = player.escalation.filter((_, index) => !mask[index])
        player.escalation = player.escalation.filter((_, index) => mask[index])
        state.escalationPool.push(...discarded)
        return discarded.length > 0 ? [{ playerId, discarded }] : []
    })
}

// Rulebook 3.0's scoring: the printed points, -1 for each red marker.
export function escalationScore(player: HydratedStellarHorizonsPlayerState): number {
    return player.escalation.reduce((total, marker) => total + escalationPoints(marker), 0)
}

export type TruceRoll = Type.Static<typeof TruceRoll>
export const TruceRoll = Type.Object({
    chance: Type.Number(),
    roll: Type.Number(),
    ended: Type.Boolean()
})

// Rulebook 3.0: from the end of 2110 a percentile roll ends the truce at or under 1%, rising 1%
// a turn.
export function truceChance(state: HydratedStellarHorizonsGameState): number | undefined {
    const truce = state.scenarioDefinition().campaign?.truce
    if (!state.truce || truce === undefined || state.year < truce.rollYear) {
        return undefined
    }
    return truce.chance + (state.year - truce.rollYear) / DECADE
}

export function rollForTruce(state: HydratedStellarHorizonsGameState): TruceRoll | undefined {
    const chance = truceChance(state)
    if (chance === undefined) {
        return undefined
    }
    const roll = state.getProtectedPrng().dieRoll(100)
    const ended = roll <= chance
    if (ended) {
        state.truce = false
    }
    return { chance, roll, ended }
}
