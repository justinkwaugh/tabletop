<script lang="ts">
    import type { Reef, Shrimp as ShrimpState } from '@tabletop/reef-encounter'
    import ShrimpPiece from './Shrimp.svelte'
    import { BoardImageUrls } from '$lib/images/art.generated.js'
    import { BoardImage, boardSquare, ImageToTable } from '$lib/utils/artGeometry.js'
    import { polypFaceUrl } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { reef, shrimps }: { reef: Reef; shrimps: readonly ShrimpState[] } = $props()

    const gameSession = getGameSession()
    const place = (row: number, col: number) =>
        `${gameSession.game.id}:${reef.boardId}:${row}:${col}`
</script>

<svg
    viewBox="0 0 {BoardImage.width} {BoardImage.height}"
    width={BoardImage.width * ImageToTable}
    height={BoardImage.height * ImageToTable}
    role="img"
    aria-label="Reef board {reef.boardId}"
>
    <image href={BoardImageUrls[reef.boardId]} width={BoardImage.width} height={BoardImage.height}
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
</svg>
