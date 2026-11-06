import { assert, assertExists } from '@tabletop/common'
import { GuildIds, PlayerDiscRoles, type GuildId } from '../data/components.js'
import {
    EpicVoyageTrack,
    MilitaryServiceTrack,
    type EpicVoyageSpace,
    type MilitaryServiceSpace
} from '../data/tracks.js'
import type { FollowUp, WritDrawSource } from './flow.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { rankOf } from './guildStatus.js'
import { drawWrits } from './writDeck.js'

/** R-4.7, R-4.9.1, R-3.7.5 The follow-ups that offer a disc. */
export type DiscFollowUp = Exclude<FollowUp, { kind: 'keep-writs' }>

export function isDiscFollowUp(followUp: FollowUp): followUp is DiscFollowUp {
    return followUp.kind !== 'keep-writs'
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

/**
 * R-4.4.1, R-4.4-H2 A writ draw resolves in the Action that triggers it, so the barrier sits there,
 * and the keep comes next, ahead of the card's other follow-ups. An empty deck draws nothing and
 * leaves nothing to keep. Returns how many were drawn.
 */
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
        state.flow.turn.followUps.unshift({ kind: 'keep-writs', playerId })
    }
    return drawn.length
}

/** R-3.7.5 The space the seat's disc would take; none past the monastery. */
export function nextVoyageSpace(
    state: HydratedFeudumGameState,
    playerId: string
): EpicVoyageSpace | undefined {
    const space = (state.voyageTrack[playerId] ?? 0) + 1
    return EpicVoyageTrack.find((row) => row.space === space)
}

/** R-4.9.1, R-4.9-H2 The seat's own next uncovered space; none when all are covered. */
export function nextMilitarySpace(
    state: HydratedFeudumGameState,
    playerId: string
): MilitaryServiceSpace | undefined {
    const space = (state.militaryService[playerId] ?? 0) + 1
    return MilitaryServiceTrack.find((row) => row.space === space)
}

const NoFreeDisc = 'You have no free disc.'

function reeveCount(state: HydratedFeudumGameState, playerId: string): number {
    return GuildIds.filter((guildId) => {
        const track = state.guilds.tracks[guildId]
        const rank = rankOf(track, playerId)
        return rank && track[rank]?.reeve
    }).length
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

/** R-4.7, R-4.9.1, R-3.7.5 Whether this disc has a free disc and a legal place, for its player. */
export function reasonDiscRefused(
    state: HydratedFeudumGameState,
    followUp: DiscFollowUp
): string | undefined {
    switch (followUp.kind) {
        case 'reeve': {
            return reasonReeveRefused(state, followUp.playerId, followUp.guildId)
        }
        case 'military': {
            return reasonMilitaryRefused(state, followUp.playerId)
        }
        case 'voyage': {
            return reasonVoyageRefused(state, followUp.playerId)
        }
    }
}
