<script lang="ts">
    import type { Reef, Shrimp as ShrimpState } from '@tabletop/reef-encounter'
    import ShrimpPiece from './Shrimp.svelte'
    import { BoardImageUrls } from '$lib/images/art.generated.js'
    import {
        BoardImage,
        boardSquare,
        ImageToTable,
        rotatedView,
        BoardView,
        type BoardRotation
    } from '$lib/utils/artGeometry.js'
    import { polypFaceUrl } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        reef,
        shrimps,
        rotation
    }: { reef: Reef; shrimps: readonly ShrimpState[]; rotation: BoardRotation } = $props()

    const drawing = $derived(rotatedView(BoardView, rotation))

    const gameSession = getGameSession()
    const place = (row: number, col: number) =>
        `${gameSession.game.id}:${reef.boardId}:${row}:${col}`
</script>

<svg
    viewBox="0 0 {drawing.size.width} {drawing.size.height}"
    width={drawing.size.width * ImageToTable}
    height={drawing.size.height * ImageToTable}
    role="img"
    aria-label="Reef board {reef.boardId}"
>
    <g transform={drawing.transform}>
        <image
            href={BoardImageUrls[reef.boardId]}
            width={BoardImage.width}
            height={BoardImage.height}
        ></image>
        {#each reef.polyps as polyp (`${polyp.coords.row},${polyp.coords.col}`)}
            {@const square = boardSquare(polyp.coords)}
            <image
                href={polypFaceUrl(polyp.color, place(polyp.coords.row, polyp.coords.col))}
                x={square.x}
                y={square.y}
                width={square.width}
                height={square.height}
            ></image>
        {/each}
        {#each shrimps as shrimp (`${shrimp.coords.row},${shrimp.coords.col}`)}
            {@const square = boardSquare(shrimp.coords)}
            <ShrimpPiece
                center={{ x: square.x + square.width / 2, y: square.y + square.height / 2 }}
                size={square.width * 0.8}
                color={gameSession.colors.getPlayerBgColorValue(shrimp.playerId)}
            />
        {/each}
    </g>
</svg>
