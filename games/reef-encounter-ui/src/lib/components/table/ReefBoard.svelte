<script lang="ts">
    import { boardName, squareName } from '$lib/utils/reefSquare.js'
    import { withArticle } from '$lib/utils/actionDescription.js'
    import type { OffsetCoordinates } from '@tabletop/common'
    import { polypAt, type Reef, type ReefSquare } from '@tabletop/reef-encounter'
    import Pieces from './Pieces.svelte'
    import Target from './Target.svelte'
    import { SquarePickerAnchorId } from './SquarePicker.svelte'
    import { BoardImageUrls } from '$lib/images/art.generated.js'
    import {
        BoardImage,
        boardSquare,
        ImageToTable,
        rotatedView,
        BoardView,
        upright,
        type BoardRotation
    } from '$lib/utils/artGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { reef, rotation }: { reef: Reef; rotation: BoardRotation } = $props()

    const drawing = $derived(rotatedView(BoardView, rotation))

    const gameSession = getGameSession()
    const targets = $derived(
        gameSession.placementTargets.filter((target) => target.boardId === reef.boardId)
    )
    const placing = $derived(gameSession.placing)
    const onBoard = (squares: readonly ReefSquare[]) =>
        squares.filter((square) => square.boardId === reef.boardId)
    const shrimpTargets = $derived(onBoard(gameSession.shrimpTargets))
    const protectedPolyps = $derived(
        onBoard(gameSession.shrimpProtectedPolyps).map((square) => square.coords)
    )
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
    const chosenSquare = $derived(
        gameSession.placementSquare?.boardId === reef.boardId
            ? gameSession.placementSquare.coords
            : undefined
    )
    const pickerAnchor = $derived(pickedUp ?? chosenSquare)
    const where = (coords: OffsetCoordinates) =>
        `on ${squareName(gameSession.gameState.reefs, { boardId: reef.boardId, coords })}`
</script>

<svg
    viewBox="0 0 {drawing.size.width} {drawing.size.height}"
    width={drawing.size.width * ImageToTable}
    height={drawing.size.height * ImageToTable}
    role="group"
    aria-label="Reef {boardName(gameSession.gameState.reefs, reef.boardId)}"
>
    <g transform={drawing.transform}>
        <image
            href={BoardImageUrls[reef.boardId]}
            width={BoardImage.width}
            height={BoardImage.height}
        ></image>
        <Pieces container={reef.boardId} {rotation} />
        {#if pickedUp}
            <Target
                box={boardSquare(pickedUp)}
                tone="chosen"
                label="Leave your shrimp {where(pickedUp)}"
                onselect={() => gameSession.putDownShrimp()}
            />
        {:else if chosenSquare}
            {@const square = boardSquare(chosenSquare)}
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
        {#if pickerAnchor}
            {@const square = boardSquare(pickerAnchor)}
            <rect
                id={SquarePickerAnchorId}
                x={square.x + square.width - 1}
                y={square.y + square.height / 2}
                width="1"
                height="1"
                fill="none"
            ></rect>
        {/if}
        {#each movableShrimps as square (`${square.coords.row},${square.coords.col}`)}
            <Target
                box={boardSquare(square.coords)}
                tone="piece"
                label="Pick up your shrimp {where(square.coords)}"
                onselect={() => gameSession.pickUpShrimp(square)}
            />
        {/each}
        {#each shrimpTargets as square (`${square.coords.row},${square.coords.col}`)}
            <Target
                box={boardSquare(square.coords)}
                label="Put your shrimp {where(square.coords)}"
                onselect={() => gameSession.placeShrimp(square)}
            />
        {/each}
        {#each edible as coral (`${coral.square.coords.row},${coral.square.coords.col}`)}
            {#each coral.squares as coords (`${coords.row},${coords.col}`)}
                <Target
                    box={boardSquare(coords)}
                    tone="eat"
                    label="Feed the {coral.squares.length}-polyp {coral.color} coral {where(
                        coords
                    )} to your parrotfish"
                    onselect={() => gameSession.eatCoral(coral.square)}
                />
            {/each}
        {/each}
        {#each protectedPolyps as coords (`${coords.row},${coords.col}`)}
            {@const square = boardSquare(coords)}
            <rect
                class="protected"
                x={square.x + 8}
                y={square.y + 8}
                width={square.width - 16}
                height={square.height - 16}
                rx="10"
                role="img"
                aria-label="{polypAt(reef, coords)?.color} polyp {where(
                    coords
                )}, protected by a shrimp"
            ></rect>
        {/each}
        {#each targets as target (`${target.coords.row},${target.coords.col}`)}
            <Target
                box={boardSquare(target.coords)}
                tone={target.attack ? 'attack' : 'plain'}
                label="{target.attack ? 'Attack with' : 'Place'} {withArticle(
                    placing?.color ?? ''
                )} polyp {where(target.coords)}{target.searchesBag
                    ? ', growing a bonus polyp from the bag, which can’t be taken back'
                    : ''}"
                onselect={() =>
                    gameSession.placePolyp({ boardId: reef.boardId, coords: target.coords })}
            />
            {#if target.searchesBag}
                {@const box = boardSquare(target.coords)}
                {@const center = { x: box.x + box.width - 38, y: box.y + 38 }}
                <g class="bag-flag" transform={upright(rotation, center)} aria-hidden="true">
                    <circle cx={center.x} cy={center.y} r="30"></circle>
                    <text x={center.x} y={center.y} dy="0.36em" text-anchor="middle">!</text>
                </g>
            {/if}
        {/each}
    </g>
</svg>

<style>
    .bag-flag {
        pointer-events: none;
    }

    .bag-flag circle {
        fill: #ffc04d;
        stroke: rgb(0 0 0 / 0.45);
        stroke-width: 2;
    }

    .bag-flag text {
        font:
            700 42px Fredoka,
            sans-serif;
        fill: #3a2200;
    }

    .protected {
        fill: none;
        stroke: #bfe6ff;
        stroke-width: 6;
        stroke-linecap: round;
        stroke-dasharray: 0.1 14;
    }
</style>
