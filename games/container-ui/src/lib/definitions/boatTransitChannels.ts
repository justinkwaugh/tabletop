import type { BoardLayout } from '$lib/definitions/boardLayout.js'

export type TransitChannelAnchor = {
    id: string
    x: number
    y: number
    width: number
    height: number
}

export function buildTransitChannelAnchors(boardLayout: BoardLayout): TransitChannelAnchor[] {
    const playerCount = boardLayout.playerBoardSeats.length
    const hasOffshore = !!boardLayout.offshoreRect

    if (playerCount === 3 && !hasOffshore) {
        return [
            { id: 'channel-top-center', x: 980, y: 120, width: 520, height: 120 },
            { id: 'channel-left-middle', x: 550, y: 620, width: 200, height: 180 },
            { id: 'channel-bottom-center', x: 980, y: 1190, width: 520, height: 140 }
        ]
    }

    return []
}
