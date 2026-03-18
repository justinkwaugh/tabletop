<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedContainerPlayerState, ContainerPlayerState } from '@tabletop/container'
    import BoardBaseLayer from '$lib/components/BoardBaseLayer.svelte'
    import Boat from '$lib/components/Boat.svelte'
    import PlayerBoard from '$lib/components/PlayerBoard.svelte'
    import { buildBoardLayout } from '$lib/definitions/boardLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const BOAT_PREVIEW_WIDTH = 195.05
    const BOAT_PREVIEW_GAP = 20
    const BOAT_PREVIEW_Y_OFFSET = 38
    const CONTAINER_PREVIEW_COLORS = ['#ffffff', '#84accf', '#e14547', '#4f984d', '#f7dd4a']

    let boardSvg: SVGSVGElement | null = $state(null)
    let boatPositionOverrides = $state<Record<string, { x: number; y: number }>>({})
    let draggingBoatId = $state<string | null>(null)
    let dragPointerId = $state<number | null>(null)
    let dragOffset = $state({ x: 0, y: 0 })

    type PlayerAndState = { player: Player; playerState: HydratedContainerPlayerState }

    const playersAndStates: PlayerAndState[] = $derived.by(() => {
        const playersAndStatesById = new Map(
            gameSession.gameState.players.map((playerState) => [
                playerState.playerId,
                {
                    player: getPlayerForState(playerState),
                    playerState
                }
            ])
        )

        return gameSession.gameState.turnManager.turnOrder
            .map((playerId) => playersAndStatesById.get(playerId))
            .filter((entry): entry is PlayerAndState => !!entry)
    })

    const boardLayout = $derived.by(() =>
        buildBoardLayout(playersAndStates.map((entry) => entry.player.id))
    )

    const playerBoardSeatById = $derived.by(
        () => new Map(boardLayout.playerBoardSeats.map((seat) => [seat.playerId, seat]))
    )

    const previewBoats = $derived.by(() => {
        const count = playersAndStates.length
        const totalWidth =
            count * BOAT_PREVIEW_WIDTH + Math.max(0, count - 1) * BOAT_PREVIEW_GAP
        const startX = (boardLayout.boardWidth - totalWidth) / 2
        const y = boardLayout.islandRect.y + boardLayout.islandRect.height + BOAT_PREVIEW_Y_OFFSET

        return playersAndStates.map((entry, index) => ({
            playerId: entry.player.id,
            color: gameSession.colors.getPlayerUiColor(entry.player.id),
            containerColors: buildPreviewContainerColors(entry.player.id),
            x:
                boatPositionOverrides[entry.player.id]?.x ??
                startX + index * (BOAT_PREVIEW_WIDTH + BOAT_PREVIEW_GAP),
            y: boatPositionOverrides[entry.player.id]?.y ?? y
        }))
    })

    function getPlayerForState(playerState: ContainerPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)!
    }

    function buildPreviewContainerColors(seedText: string): string[] {
        let seed = 0
        for (const char of seedText) {
            seed = (seed * 31 + char.charCodeAt(0)) >>> 0
        }

        seed = (seed * 1664525 + 1013904223) >>> 0
        const containerCount = 2 + (seed % 4)

        return Array.from({ length: containerCount }, () => {
            seed = (seed * 1664525 + 1013904223) >>> 0
            return CONTAINER_PREVIEW_COLORS[seed % CONTAINER_PREVIEW_COLORS.length]!
        })
    }

    function pointerEventToBoardPoint(event: PointerEvent) {
        const svg = boardSvg
        if (!svg) {
            return null
        }

        const ctm = svg.getScreenCTM()
        if (!ctm) {
            return null
        }

        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
        return { x: point.x, y: point.y }
    }

    function handleBoatPointerDown(event: PointerEvent, boatId: string, x: number, y: number) {
        const point = pointerEventToBoardPoint(event)
        if (!point || !boardSvg) {
            return
        }

        draggingBoatId = boatId
        dragPointerId = event.pointerId
        dragOffset = {
            x: point.x - x,
            y: point.y - y
        }
        boardSvg.setPointerCapture(event.pointerId)
    }

    function handleBoardPointerMove(event: PointerEvent) {
        if (!draggingBoatId || event.pointerId !== dragPointerId) {
            return
        }

        const point = pointerEventToBoardPoint(event)
        if (!point) {
            return
        }

        boatPositionOverrides = {
            ...boatPositionOverrides,
            [draggingBoatId]: {
                x: point.x - dragOffset.x,
                y: point.y - dragOffset.y
            }
        }
    }

    function handleBoardPointerUp(event: PointerEvent) {
        if (!boardSvg || event.pointerId !== dragPointerId) {
            return
        }

        if (boardSvg.hasPointerCapture(event.pointerId)) {
            boardSvg.releasePointerCapture(event.pointerId)
        }

        draggingBoatId = null
        dragPointerId = null
    }
</script>

<div class="board-shell">
    <div
        class="board-surface relative"
        style={`width:${boardLayout.boardWidth}px;height:${boardLayout.boardHeight}px;`}
    >
        <svg
            class="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${boardLayout.boardWidth} ${boardLayout.boardHeight}`}
            aria-label="Container board"
            bind:this={boardSvg}
            onpointermove={handleBoardPointerMove}
            onpointerup={handleBoardPointerUp}
            onpointercancel={handleBoardPointerUp}
        >
            <BoardBaseLayer
                boardWidth={boardLayout.boardWidth}
                boardHeight={boardLayout.boardHeight}
                boardCornerRadius={boardLayout.boardCornerRadius}
                islandRect={boardLayout.islandRect}
            />
            {#each previewBoats as boat (boat.playerId)}
                <g
                    class="cursor-grab active:cursor-grabbing"
                    onpointerdown={(event) =>
                        handleBoatPointerDown(event, boat.playerId, boat.x, boat.y)}
                >
                    <Boat
                        x={boat.x}
                        y={boat.y}
                        width={BOAT_PREVIEW_WIDTH}
                        color={boat.color}
                        containerColors={boat.containerColors}
                    />
                </g>
            {/each}
            {#each playersAndStates as playerAndState (playerAndState.player.id)}
                {@const seat = playerBoardSeatById.get(playerAndState.player.id)}
                {#if seat}
                    <PlayerBoard
                        player={playerAndState.player}
                        playerState={playerAndState.playerState}
                        orientation={seat.orientation}
                        x={seat.x}
                        y={seat.y}
                        width={seat.width}
                        height={seat.height}
                    />
                {/if}
            {/each}
        </svg>
    </div>
</div>

<style>
    .board-shell {
        position: relative;
        display: inline-flex;
        border-radius: 28px;
        background:
            radial-gradient(980px 680px at 50% 42%, rgba(141, 154, 217, 0.24), transparent 62%),
            #444a78;
    }

    .board-surface {
        overflow: hidden;
        border-radius: 24px;
        box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.08),
            0 18px 42px rgba(7, 12, 34, 0.34);
    }
</style>
