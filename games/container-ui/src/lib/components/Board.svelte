<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedContainerPlayerState, ContainerPlayerState } from '@tabletop/container'
    import BoardBaseLayer from '$lib/components/BoardBaseLayer.svelte'
    import Boat from '$lib/components/Boat.svelte'
    import largeConnectorImg from '$lib/images/large-connector.svg'
    import sideConnectorImg from '$lib/images/side-connector.svg'
    import PlayerBoard from '$lib/components/PlayerBoard.svelte'
    import { buildBoardLayout } from '$lib/definitions/boardLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const BOAT_PREVIEW_WIDTH = 195.05
    const BOAT_PREVIEW_GAP = 20
    const BOAT_PREVIEW_Y_OFFSET = 38
    const CONTAINER_PREVIEW_COLORS = ['#ffffff', '#84accf', '#e14547', '#4f984d', '#f7dd4a']
    const PLAYER_BOARD_UNDERLAY_FILL = '#727780'
    const PLAYER_BOARD_UNDERLAY_BACK_OFFSET_X = -48
    const BOARD_SOURCE_WIDTH = 448
    const BOARD_SOURCE_HEIGHT = 755
    const LARGE_CONNECTOR_SOURCE_WIDTH = 623.07
    const LARGE_CONNECTOR_SOURCE_HEIGHT = 500
    const LARGE_CONNECTOR_OVERLAP_Y = 110
    const LARGE_CONNECTOR_OFFSET_X = -35
    const SIDE_CONNECTOR_SOURCE_WIDTH = 863.09
    const SIDE_CONNECTOR_SOURCE_HEIGHT = 568.78
    const SIDE_CONNECTOR_TOP_OFFSET_X = -262
    const SIDE_CONNECTOR_TOP_OFFSET_Y = 130
    const SIDE_CONNECTOR_BOTTOM_OFFSET_X = -215
    const SIDE_CONNECTOR_BOTTOM_OFFSET_Y = -160

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

    const largeConnectorPlacements = $derived.by(() => {
        const leftSeats = boardLayout.playerBoardSeats
            .filter((seat) => seat.orientation === 'left')
            .sort((a, b) => a.y - b.y)
        const rightSeats = boardLayout.playerBoardSeats
            .filter((seat) => seat.orientation === 'right')
            .sort((a, b) => a.y - b.y)

        return [...leftSeats, ...rightSeats]
            .map((seat, index, seats) => {
                const nextSeat = seats[index + 1]
                if (!nextSeat || nextSeat.orientation !== seat.orientation) {
                    return null
                }

                const width = seat.width * (LARGE_CONNECTOR_SOURCE_WIDTH / BOARD_SOURCE_WIDTH)
                const height = seat.height * (LARGE_CONNECTOR_SOURCE_HEIGHT / BOARD_SOURCE_HEIGHT)
                const x =
                    seat.orientation === 'left'
                        ? seat.x + LARGE_CONNECTOR_OFFSET_X
                        : seat.x + seat.width - LARGE_CONNECTOR_OFFSET_X
                const y = seat.y + seat.height - LARGE_CONNECTOR_OVERLAP_Y
                const transform =
                    seat.orientation === 'left'
                        ? `translate(${x} ${y})`
                        : `translate(${x} ${y}) scale(-1 1)`

                return {
                    key: `${seat.playerId}-${nextSeat.playerId}`,
                    width,
                    height,
                    transform
                }
            })
            .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    })

    const sideConnectorPlacements = $derived.by(() => {
        const seatsByOrientation = {
            left: boardLayout.playerBoardSeats
                .filter((seat) => seat.orientation === 'left')
                .sort((a, b) => a.y - b.y),
            right: boardLayout.playerBoardSeats
                .filter((seat) => seat.orientation === 'right')
                .sort((a, b) => a.y - b.y)
        }

        return (
            Object.values(seatsByOrientation) as Array<typeof boardLayout.playerBoardSeats>
        ).flatMap((seats) =>
            seats.flatMap((seat, index) => {
                const placements: Array<{
                    key: string
                    width: number
                    height: number
                    transform: string
                }> = []
                const width = seat.width * (SIDE_CONNECTOR_SOURCE_WIDTH / BOARD_SOURCE_WIDTH)
                const height = seat.height * (SIDE_CONNECTOR_SOURCE_HEIGHT / BOARD_SOURCE_HEIGHT)

                if (index === 0) {
                    const topX =
                        seat.orientation === 'left'
                            ? seat.x + SIDE_CONNECTOR_TOP_OFFSET_X
                            : seat.x + seat.width - SIDE_CONNECTOR_TOP_OFFSET_X
                    const topY = seat.y + SIDE_CONNECTOR_TOP_OFFSET_Y
                    const topTransform =
                        seat.orientation === 'left'
                            ? `translate(${topX} ${topY}) scale(1 -1)`
                            : `translate(${topX} ${topY}) scale(-1 -1)`

                    placements.push({
                        key: `${seat.playerId}-top`,
                        width,
                        height,
                        transform: topTransform
                    })
                }

                if (index === seats.length - 1) {
                    const bottomX =
                        seat.orientation === 'left'
                            ? seat.x + SIDE_CONNECTOR_BOTTOM_OFFSET_X
                            : seat.x + seat.width - SIDE_CONNECTOR_BOTTOM_OFFSET_X
                    const bottomY = seat.y + seat.height + SIDE_CONNECTOR_BOTTOM_OFFSET_Y
                    const bottomTransform =
                        seat.orientation === 'left'
                            ? `translate(${bottomX} ${bottomY})`
                            : `translate(${bottomX} ${bottomY}) scale(-1 1)`

                    placements.push({
                        key: `${seat.playerId}-bottom`,
                        width,
                        height,
                        transform: bottomTransform
                    })
                }

                return placements
            })
        )
    })

    const previewBoats = $derived.by(() => {
        const count = playersAndStates.length
        const totalWidth = count * BOAT_PREVIEW_WIDTH + Math.max(0, count - 1) * BOAT_PREVIEW_GAP
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
            {#each sideConnectorPlacements as connector (connector.key)}
                <g transform={connector.transform}>
                    <image
                        href={sideConnectorImg}
                        x="0"
                        y="0"
                        width={connector.width}
                        height={connector.height}
                        preserveAspectRatio="none"
                    ></image>
                </g>
            {/each}
            {#each largeConnectorPlacements as connector (connector.key)}
                <g transform={connector.transform}>
                    <image
                        href={largeConnectorImg}
                        x="0"
                        y="0"
                        width={connector.width}
                        height={connector.height}
                        preserveAspectRatio="none"
                    ></image>
                </g>
            {/each}
            {#each boardLayout.playerBoardSeats as seat (seat.playerId)}
                <rect
                    x={seat.orientation === 'left'
                        ? seat.x + PLAYER_BOARD_UNDERLAY_BACK_OFFSET_X
                        : seat.x - PLAYER_BOARD_UNDERLAY_BACK_OFFSET_X}
                    y={seat.y}
                    width={seat.width}
                    height={seat.height}
                    fill={PLAYER_BOARD_UNDERLAY_FILL}
                ></rect>
            {/each}
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
