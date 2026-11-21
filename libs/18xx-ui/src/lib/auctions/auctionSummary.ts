import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

/** A player named in an auction's summary, drawn as a dot of their colour before their name. */
export type AuctionSummaryPlayer = { id: string; name: string; color: string }

/** A line of an auction's summary: a figure, or the players it names. */
export type AuctionSummaryLine =
    { label: string; value: string } | { label: string; players: readonly AuctionSummaryPlayer[] }

export function auctionSummaryPlayers(
    session: Pick<EighteenXXSessionView, 'getPlayerName' | 'colors'>,
    playerIds: readonly string[]
): AuctionSummaryPlayer[] {
    return playerIds.map((id) => ({
        id,
        name: session.getPlayerName(id),
        color: session.colors.getPlayerBgColorValue(id)
    }))
}
