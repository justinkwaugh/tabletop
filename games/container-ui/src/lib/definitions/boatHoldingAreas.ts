import type { BoardLayout, BoardRect } from '$lib/definitions/boardLayout.js'

export type OpenWaterSlot = {
    id: string
    x: number
    y: number
    heading: number
}

function getRowFractions(count: number): number[] {
    switch (count) {
        case 1:
            return [0.5]
        case 2:
            return [0.32, 0.68]
        case 3:
            return [0.22, 0.5, 0.78]
        default:
            throw new Error(`Unsupported open-water row count: ${count}`)
    }
}

function createRowSlots(
    rect: BoardRect,
    y: number,
    count: number,
    startIndex: number
): OpenWaterSlot[] {
    return getRowFractions(count).map((fraction, index) => ({
        id: `open-water-${startIndex + index}`,
        x: rect.x + rect.width * fraction,
        y,
        heading: 0
    }))
}

function createCustomSlots(
    rect: BoardRect,
    entries: Array<{ xFraction: number; y: number }>,
    startIndex: number
): OpenWaterSlot[] {
    return entries.map((entry, index) => ({
        id: `open-water-${startIndex + index}`,
        x: rect.x + rect.width * entry.xFraction,
        y: entry.y,
        heading: 0
    }))
}

function createAbsoluteSlots(
    entries: Array<{ x: number; y: number }>,
    startIndex: number
): OpenWaterSlot[] {
    return entries.map((entry, index) => ({
        id: `open-water-${startIndex + index}`,
        x: entry.x,
        y: entry.y,
        heading: 0
    }))
}

function getTopRowY(boardLayout: BoardLayout): number {
    return boardLayout.islandRect.y / 2
}

function getBottomReferenceRect(boardLayout: BoardLayout): BoardRect {
    return boardLayout.offshoreRect ?? boardLayout.islandRect
}

function getBottomRowY(boardLayout: BoardLayout): number {
    const bottomRect = getBottomReferenceRect(boardLayout)
    const remainingHeight = boardLayout.boardHeight - (bottomRect.y + bottomRect.height)
    return bottomRect.y + bottomRect.height + remainingHeight / 2
}

export function buildOpenWaterSlots(boardLayout: BoardLayout): OpenWaterSlot[] {
    const playerCount = boardLayout.playerBoardSeats.length
    const hasOffshore = !!boardLayout.offshoreRect
    const topRowY = getTopRowY(boardLayout)
    const bottomRowY = getBottomRowY(boardLayout)
    const topRowRect = boardLayout.islandRect
    const bottomRowRect = getBottomReferenceRect(boardLayout)

    switch (playerCount) {
        case 3:
            if (hasOffshore) {
                return createAbsoluteSlots(
                    [
                        {
                            x: boardLayout.boardWidth - 280,
                            y: boardLayout.islandRect.y + 60
                        },
                        {
                            x: 220,
                            y: boardLayout.boardHeight - 120
                        },
                        {
                            x: boardLayout.boardWidth - 220,
                            y: boardLayout.boardHeight - 120
                        }
                    ],
                    0
                )
            }

            return createAbsoluteSlots(
                [
                    { x: boardLayout.boardWidth - 190, y: boardLayout.boardHeight - 220 },
                    { x: boardLayout.boardWidth - 190, y: boardLayout.boardHeight - 150 },
                    { x: boardLayout.boardWidth - 190, y: boardLayout.boardHeight - 80 }
                ],
                0
            )
        case 4:
            if (hasOffshore) {
                return createAbsoluteSlots(
                    [
                        { x: boardLayout.boardWidth - 300, y: boardLayout.islandRect.y + 80 },
                        { x: boardLayout.boardWidth - 220, y: boardLayout.islandRect.y + 220 },
                        { x: 220, y: boardLayout.boardHeight - 260 },
                        { x: 320, y: boardLayout.boardHeight - 120 }
                    ],
                    0
                )
            }

            return [
                ...createRowSlots(topRowRect, topRowY, 2, 0),
                ...createRowSlots(bottomRowRect, bottomRowY, 2, 2)
            ]
        case 5:
            if (hasOffshore) {
                return createAbsoluteSlots(
                    [
                        { x: boardLayout.boardWidth - 500, y: boardLayout.islandRect.y + 70 },
                        { x: boardLayout.boardWidth - 300, y: boardLayout.islandRect.y + 70 },
                        { x: boardLayout.boardWidth - 100, y: boardLayout.islandRect.y + 70 },
                        { x: boardLayout.boardWidth - 400, y: boardLayout.islandRect.y + 215 },
                        { x: boardLayout.boardWidth - 200, y: boardLayout.islandRect.y + 215 }
                    ],
                    0
                )
            }

            if (!hasOffshore) {
                const bottomRowY = getBottomRowY(boardLayout)
                return [
                    ...createRowSlots(topRowRect, topRowY, 2, 0),
                    ...createCustomSlots(
                        bottomRowRect,
                        [
                            { xFraction: 0.24, y: bottomRowY + 92 },
                            { xFraction: 0.5, y: bottomRowY - 8 },
                            { xFraction: 0.76, y: bottomRowY + 92 }
                        ],
                        2
                    )
                ]
            }

            return [
                ...createRowSlots(topRowRect, topRowY, 2, 0),
                ...createRowSlots(bottomRowRect, bottomRowY, 3, 2)
            ]
        default:
            throw new Error(
                `Unsupported Container player count for open-water slots: ${playerCount} (${hasOffshore ? 'offshore' : 'no offshore'})`
            )
    }
}
