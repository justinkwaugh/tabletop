import { assert } from '@tabletop/common'
import {
    type ActionCardKind,
    type HydratedFeudumGameState,
    knightRows,
    placeMarker,
    rowSeat,
    type SpaceId
} from '@tabletop/feudum'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { atPlayingCards, emptySpace, type TurnTable } from './turnTable.js'
import {
    setBarn,
    setCarts,
    setMarket,
    setRowMarkers,
    setScrolls,
    setVesselsForSale,
    setFarmGoods,
    type GoodAmounts
} from '@tabletop/feudum/testing'

/** R-4.6.3 */
export function ruleFarm(
    state: HydratedFeudumGameState,
    playerId: string,
    amounts: GoodAmounts
): SpaceId {
    const spaceId = emptySpace(state, 'farm')
    placeMarker(state, playerId, spaceId)
    setFarmGoods(state, spaceId, amounts)
    return spaceId
}

/** R-1.4-H1 */
export function seatRowIndex(state: HydratedFeudumGameState, playerId: string): number {
    return knightRows(state).findIndex(({ row }) => rowSeat(row.owner) === playerId)
}

export function clearGuilds(state: HydratedFeudumGameState): void {
    setBarn(state, {})
    setMarket(state, {})
    setCarts(state, {})
    setRowMarkers(
        state,
        knightRows(state).map(() => 0)
    )
    setScrolls(state, [])
    setVesselsForSale(state, [])
}

export interface GuildTable extends TurnTable {
    readonly session: FeudumGameSession
    readonly third: string
}

export type GuildArrange = (state: HydratedFeudumGameState, table: GuildSeats) => void

export interface GuildSeats {
    readonly seat: string
    readonly other: string
    readonly third: string
}

/** R-3.2 The seat asked holds these cards, the guild boards hold what `arrange` puts there. */
export async function guildTable(
    arrange: GuildArrange = () => {},
    cards: readonly ActionCardKind[] = ['guild', 'move', 'tax']
): Promise<GuildTable> {
    const turn = await atPlayingCards(cards)
    const { host, seat, other } = turn
    const third = host.order.find((id) => id !== seat && id !== other)
    assert(third, 'Three seats play')
    host.edit((state) => {
        clearGuilds(state)
        arrange(state, { seat, other, third })
        state.recomputeRanks()
    })
    return { ...turn, third, session: await host.openSeat(seat) }
}
