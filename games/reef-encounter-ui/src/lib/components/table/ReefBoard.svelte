<script lang="ts">
    import type { OffsetCoordinates } from '@tabletop/common'
    import type { Reef, ReefSquare, Shrimp as ShrimpState } from '@tabletop/reef-encounter'
    import ShrimpPiece from './Shrimp.svelte'
    import Target from './Target.svelte'
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
    const targets = $derived(
        gameSession.placementTargets.filter((target) => target.boardId === reef.boardId)
    )
    const placing = $derived(gameSession.placing)
    const onBoard = (squares: readonly ReefSquare[]) =>
        squares.filter((square) => square.boardId === reef.boardId)
    const shrimpTargets = $derived(onBoard(gameSession.shrimpTargets))
    const movableShrimps = $derived(onBoard(gameSession.movableShrimps))
    const intent = $derived(gameSession.shrimpIntent)
    const edible = $derived(
        gameSession.edibleCorals.filter((coral) => coral.square.boardId === reef.boardId)
    )
    const pickedUp = $derived(
        intent?.kind === 'move' && intent.from.boardId === reef.boardId
            ? intent.from.coords
            : undefined
    )
    const where = (coords: OffsetCoordinates) =>
        `board ${reef.boardId}, row ${coords.row + 1}, column ${coords.col + 1}`
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
        {#if pickedUp}
            {@const square = boardSquare(pickedUp)}
            <rect
                x={square.x + 3}
                y={square.y + 3}
                width={square.width - 6}
                height={square.height - 6}
                rx="12"
                fill="none"
                stroke="#ef8f2e"
                stroke-width="8"
            ></rect>
        {/if}
        {#each movableShrimps as square (`${square.coords.row},${square.coords.col}`)}
            <Target
                box={boardSquare(square.coords)}
                tone="piece"
                label="Pick up your shrimp on {where(square.coords)}"
                onselect={() => gameSession.pickUpShrimp(square)}
            />
        {/each}
        {#each shrimpTargets as square (`${square.coords.row},${square.coords.col}`)}
            <Target
                box={boardSquare(square.coords)}
                label="Put your shrimp on {where(square.coords)}"
                onselect={() => gameSession.placeShrimp(square)}
            />
        {/each}
        {#each edible as coral (`${coral.square.coords.row},${coral.square.coords.col}`)}
            {#each coral.squares as coords (`${coords.row},${coords.col}`)}
                <Target
                    box={boardSquare(coords)}
                    tone="eat"
                    label="Feed the {coral.squares.length}-polyp {coral.color} coral on {where(
                        coords
                    )} to your parrotfish"
                    onselect={() => gameSession.eatCoral(coral.square)}
                />
            {/each}
        {/each}
        {#each targets as target (`${target.coords.row},${target.coords.col}`)}
            <Target
                box={boardSquare(target.coords)}
                tone={target.attack ? 'attack' : 'plain'}
                label="{target.attack
                    ? 'Attack with'
                    : 'Place'} a {placing?.color} polyp on board {reef.boardId}, row {target.coords
                    .row + 1}, column {target.coords.col + 1}"
                onselect={() => gameSession.placePolyp(reef.boardId, target.coords)}
            />
        {/each}
    </g>
</svg>
