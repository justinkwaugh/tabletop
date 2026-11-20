import { assert, assertExists } from '@tabletop/common'
import { GuildIds, PlayerDiscRoles, type GuildId } from '../data/components.js'
import type { WritId } from '../data/writs.js'
import type { FollowUp, WritDrawSource } from './flow.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { rankOf } from './guildStatus.js'
import { nextMilitarySpace, nextVoyageSpace } from './tracks.js'
import { cardTurnSeat } from './turns.js'
import { drawWrits } from './writDeck.js'

/** R-4.7, R-4.9.1, R-3.7.5 */
export type DiscFollowUp = Extract<FollowUp, { kind: 'reeve' | 'military' | 'voyage' }>

export function isDiscFollowUp(followUp: FollowUp): followUp is DiscFollowUp {
    return followUp.kind === 'reeve' || followUp.kind === 'military' || followUp.kind === 'voyage'
}

/** R-3.2, R-3.3 The current card leaves this behind; `stateAfterCardStep` runs the list in order. */
export function queueFollowUp(state: HydratedFeudumGameState, followUp: FollowUp): void {
    assertExists(state.flow.turn, 'R-3.2 A follow-up belongs to the card being played')
    state.flow.turn.followUps.push(followUp)
}

/** R-3.2 The follow-up being decided, ahead of the rest. */
export function currentFollowUp(state: HydratedFeudumGameState): FollowUp | undefined {
    return state.flow.turn?.followUps.at(0)
}

/** R-3.2 The follow-up being decided is done. */
export function finishFollowUp(state: HydratedFeudumGameState): void {
    assertExists(state.flow.turn, 'R-3.2 A follow-up belongs to the card being played')
    assert(state.flow.turn.followUps.length > 0, 'R-3.2 A follow-up is being decided')
    state.flow.turn.followUps.shift()
}

/** R-4.7, R-4.9.1, R-3.7.5 The next follow-up still open: a disc offer whose place has gone is dropped unasked. */
export function nextOpenFollowUp(state: HydratedFeudumGameState): FollowUp | undefined {
    const { turn } = state.flow
    while (turn && turn.followUps.length > 0) {
        const [followUp] = turn.followUps
        if (!isDiscFollowUp(followUp) || !reasonDiscRefused(state, followUp)) {
            return followUp
        }
        turn.followUps.shift()
    }
    return undefined
}

/** R-4.4.1, R-4.4-H2 The draw is the barrier; the keep comes next. Returns how many. */
export function drawWritsToKeep(
    state: HydratedFeudumGameState,
    playerId: string,
    { draw, keep }: { readonly draw: number; readonly keep: number },
    source: WritDrawSource
): number {
    assertExists(state.flow.turn, 'R-3.2 A writ draw belongs to the card being played')
    const drawn = drawWrits(state, draw)
    if (drawn.length > 0) {
        state.flow.writDraw = {
            playerId,
            drawnCount: drawn.length,
            keep: Math.min(keep, drawn.length),
            source,
            shovelsOffered: false,
            drawn
        }
        state.flow.turn.followUps.unshift({ kind: 'keep-writs' })
    }
    return drawn.length
}

/** R-4.4.1 Owner-known: only the drawer's state and the host's carry the writs. */
export function requireDrawnWrits(writDraw: { readonly drawn?: WritId[] }): WritId[] {
    assertExists(writDraw.drawn, 'R-4.4.1 The writs drawn are owner-known')
    return writDraw.drawn
}

const NoFreeDisc = 'You have no free disc.'

function reeveCount(state: HydratedFeudumGameState, playerId: string): number {
    return GuildIds.filter((guildId) => {
        const track = state.guilds.tracks[guildId]
        const rank = rankOf(track, playerId)
        return rank && track[rank]?.reeve
    }).length
}

/** R-4.7 */
export function reevePointsIn(
    state: HydratedFeudumGameState,
    playerId: string,
    guildId: GuildId
): number {
    const track = state.guilds.tracks[guildId]
    const rank = rankOf(track, playerId)
    return rank && track[rank]?.reeve ? reeveCount(state, playerId) : 0
}

/** R-4.7 On the seat's marker, master or journeyman; none in that guild; at most 2. */
function reasonReeveRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    guildId: GuildId
): string | undefined {
    const track = state.guilds.tracks[guildId]
    const rank = rankOf(track, playerId)
    if (!rank || rank === 'apprentice') {
        return 'You hold no rank a reeve can follow there.'
    }
    if (track[rank]?.reeve) {
        return 'You already have a reeve in that guild.'
    }
    if (reeveCount(state, playerId) >= PlayerDiscRoles.reevesAtMost) {
        return `You already have ${PlayerDiscRoles.reevesAtMost} reeves.`
    }
    return state.freeDiscs(playerId) > 0 ? undefined : NoFreeDisc
}

/** R-4.9.1, R-4.9-H2 */
function reasonMilitaryRefused(
    state: HydratedFeudumGameState,
    playerId: string
): string | undefined {
    if (!nextMilitarySpace(state, playerId)) {
        return 'You have covered every military service space.'
    }
    return state.freeDiscs(playerId) > 0 ? undefined : NoFreeDisc
}

/** R-3.7.5, R-3.7-H1 Only starting takes a free disc: a disc on the track just steps on. */
function reasonVoyageRefused(state: HydratedFeudumGameState, playerId: string): string | undefined {
    if (!nextVoyageSpace(state, playerId)) {
        return 'Your disc has reached the monastery.'
    }
    return Object.hasOwn(state.voyageTrack, playerId) || state.freeDiscs(playerId) > 0
        ? undefined
        : NoFreeDisc
}

/** R-3.2 Every follow-up is the turn seat's to decide. */
export function followUpSeat(state: HydratedFeudumGameState): string {
    const playerId = cardTurnSeat(state)
    assertExists(playerId, 'R-3.2 A follow-up belongs to the turn being played')
    return playerId
}

/** R-4.7, R-4.9.1, R-3.7.5 Whether the turn seat has a free disc and a legal place for it. */
export function reasonDiscRefused(
    state: HydratedFeudumGameState,
    followUp: DiscFollowUp
): string | undefined {
    const playerId = followUpSeat(state)
    switch (followUp.kind) {
        case 'reeve': {
            return reasonReeveRefused(state, playerId, followUp.guildId)
        }
        case 'military': {
            return reasonMilitaryRefused(state, playerId)
        }
        case 'voyage': {
            return reasonVoyageRefused(state, playerId)
        }
    }
}
