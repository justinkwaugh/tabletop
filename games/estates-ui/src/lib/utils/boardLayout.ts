import type { HydratedEstatesGameBoard } from '@tabletop/estates'

export function playerPanelHeight(board: HydratedEstatesGameBoard): number {
    return (
        Math.max(
            2,
            board.maxRowHeight(0) - 0.8,
            board.maxRowHeight(1) - 1.5,
            board.maxRowHeight(2) - 3
        ) + 0.5
    )
}
