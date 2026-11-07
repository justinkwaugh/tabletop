import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    MachineState,
    placeMarker,
    type ActionCardKind,
    type HydratedFeudumGameState,
    type SpaceId
} from '@tabletop/feudum'
import { markerTarget, pawnTarget } from '$lib/model/boardOffer.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { holdFood, seatedAtCards, type SeatTable } from './followUpTable.js'
import { settled } from './sessionHarness.js'
import { addPawn, emptySpaces } from './turnTable.js'

export interface AskTable extends SeatTable {
    /** The seat asked. */
    readonly asked: FeudumGameSession
    /** A seat neither side of it. */
    readonly third: FeudumGameSession
    readonly spaceId: SpaceId
}

/** Three seats open at a table where `seat` holds Conquer; nothing is sent yet. */
async function seated(
    otherCards: readonly ActionCardKind[],
    arrange: (state: HydratedFeudumGameState, seat: string, other: string, at: SpaceId) => void
) {
    let spaceId: SpaceId = 'space.desert.1'
    const table = await seatedAtCards(
        ['conquer', 'tax', 'move'],
        (state, { seat, other }) => {
            spaceId = emptySpaces(state, 'outpost')[0]
            arrange(state, seat, other, spaceId)
            state.recomputeRanks()
            // The third seat's own hand stays the same whatever the asked seat holds.
            for (const player of state.players) {
                if (player.playerId !== seat && player.playerId !== other) {
                    player.hand = ['tax', 'guild']
                    player.handCount = player.hand.length
                }
            }
        },
        { otherCards: [...otherCards] }
    )
    const thirdId = table.host.order.find((id) => id !== table.seat && id !== table.other)
    assertExists(thirdId, 'Three seats')
    const asked = await table.host.openSeat(table.other)
    const third = await table.host.openSeat(thirdId)
    return { ...table, asked, third, spaceId }
}

async function allSettled(...sessions: readonly FeudumGameSession[]) {
    for (const session of sessions) {
        await settled(session)
    }
}

/** R-3.13, R-3.14.1 The attacker's Conquer picked and aimed at the other's knight, not yet sent. */
export async function stagedConquer(
    otherCards: readonly ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, seat: string) => void
): Promise<AskTable> {
    const table = await seated(otherCards, (state, seat, other, at) => {
        addPawn(state, seat, 'knight', at)
        addPawn(state, other, 'knight', at)
        arrange?.(state, seat)
    })
    const { session, other, spaceId } = table
    session.pressTurnCard('conquer')
    flushSync()
    const pawn = session.gameState
        .getPlayerState(other)
        .pawns.find((row) => row.spaceId === spaceId)
    assertExists(pawn, 'The defender has a pawn there')
    await session.pressTurnTarget(pawnTarget(other, pawn.n))
    flushSync()
    return table
}

/** R-3.14.1 The Conquer sent: the knight's owner is asked, holding `otherCards`. */
export async function askedToDefend(
    otherCards: readonly ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, seat: string) => void
): Promise<AskTable> {
    const table = await stagedConquer(otherCards, arrange)
    await table.session.sendTurnCard()
    await allSettled(table.session, table.asked, table.third)
    return table
}

/** R-3.14.2 Starve the People sent: the serf's owner is asked, holding `otherCards` and a food. */
export async function askedToStarve(otherCards: readonly ActionCardKind[]): Promise<AskTable> {
    const table = await seated(otherCards, (state, seat, other, at) => {
        addPawn(state, seat, 'noble', at)
        placeMarker(state, seat, at)
        placeMarker(state, other, at)
        holdFood(state, other, 1)
    })
    const { session, other, spaceId } = table
    session.pressTurnCard('conquer')
    flushSync()
    const starve = session.turnPanel?.modes.find(({ label }) => label === 'Starve the People')
    assertExists(starve, 'Conquer may starve')
    await session.pressTurnChoice(starve)
    flushSync()
    await session.pressTurnTarget(markerTarget(spaceId, other, 'serf'))
    flushSync()
    await session.sendTurnCard()
    await allSettled(session, table.asked, table.third)
    if (session.gameState.machineState !== MachineState.AwaitingImmunity) {
        throw new Error(`Asked in ${session.gameState.machineState}`)
    }
    return table
}
