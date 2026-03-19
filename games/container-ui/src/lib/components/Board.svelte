<script lang="ts">
    import { onMount } from 'svelte'
    import type { Player } from '@tabletop/common'
    import type { HydratedContainerPlayerState, ContainerPlayerState } from '@tabletop/container'
    import BoardBaseLayer from '$lib/components/BoardBaseLayer.svelte'
    import Boat from '$lib/components/Boat.svelte'
    import {
        boatHeadingToRenderRotation,
        DEFAULT_BOAT_RENDER_HEIGHT,
        DEFAULT_BOAT_RENDER_WIDTH,
        DEFAULT_BOAT_RENDER_WIDTH as BOAT_WIDTH
    } from '$lib/definitions/boatGeometry.js'
    import { getMotionPathLength, sampleMotionPath } from '$lib/definitions/boatMotion.js'
    import { buildBoatNavigationGeometry } from '$lib/definitions/boatNavigation.js'
    import {
        buildDockTransferPlan,
        type BoatRoutePlan
    } from '$lib/definitions/boatPlanner.js'
    import largeConnectorImg from '$lib/images/large-connector.svg'
    import sideConnectorImg from '$lib/images/side-connector.svg'
    import PlayerBoard from '$lib/components/PlayerBoard.svelte'
    import { buildBoardLayout } from '$lib/definitions/boardLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
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
    const ROUTE_STATUS_PANEL_X = 24
    const ROUTE_STATUS_PANEL_Y = 24

    let demoAnimationMs = $state(0)
    let selectedStartDockId = $state<string | null>(null)
    let selectedTargetDockId = $state<string | null>(null)

    type PlayerAndState = { player: Player; playerState: HydratedContainerPlayerState }
    type RouteProbeState =
        | {
              status: 'idle'
              message: string
          }
        | {
              status: 'awaiting-target'
              message: string
              startDockId: string
          }
        | {
              status: 'failed'
              message: string
              startDockId: string
              targetDockId: string
          }
        | {
              status: 'success'
              message: string
              startDockId: string
              targetDockId: string
              movingBoatColor: string
              plan: BoatRoutePlan
          }

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

    const hasOffshoreIsland = $derived(!!gameSession.gameState.investmentBank)
    const boardLayout = $derived.by(() =>
        buildBoardLayout(playersAndStates.map((entry) => entry.player.id), {
            hasOffshore: hasOffshoreIsland
        })
    )

    const playerBoardSeatById = $derived.by(
        () => new Map(boardLayout.playerBoardSeats.map((seat) => [seat.playerId, seat]))
    )
    const boatNavigationGeometry = $derived.by(() => buildBoatNavigationGeometry(boardLayout))

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

    const harborDockBoats = $derived.by(() => {
        const harborSlots = [
            ...boatNavigationGeometry.mainIslandDockSlots,
            ...boatNavigationGeometry.offshoreDockSlots
        ]

        return harborSlots.map((slot, slotIndex) => {
            const index = slotIndex
            const player = playersAndStates[index % playersAndStates.length]
            const color = player
                ? gameSession.colors.getPlayerUiColor(player.player.id)
                : '#84accf'

            return {
                key: `harbor-dock-boat-${index}`,
                dockId: slot.id,
                x: slot.dockedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
                y: slot.dockedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                rotation: boatHeadingToRenderRotation(slot.dockedPose.heading),
                color
            }
        })
    })
    const playerBoardDockTargets = $derived.by(() =>
        boatNavigationGeometry.playerBoardDockSlots.map((slot) => ({
            dockId: slot.id,
            x: slot.dockedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
            y: slot.dockedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
            width: DEFAULT_BOAT_RENDER_WIDTH,
            height: DEFAULT_BOAT_RENDER_HEIGHT
        }))
    )

    const routeProbe = $derived.by<RouteProbeState>(() => {
        if (!selectedStartDockId) {
            return {
                status: 'idle',
                message: 'Select a harbor boat, then click a player board dock.'
            }
        }

        if (!selectedTargetDockId) {
            return {
                status: 'awaiting-target',
                startDockId: selectedStartDockId,
                message: 'Select a specific player board dock to test the route.'
            }
        }

        const harborDockSlots = [
            ...boatNavigationGeometry.mainIslandDockSlots,
            ...boatNavigationGeometry.offshoreDockSlots
        ]
        const startDock = harborDockSlots.find(
            (slot) => slot.id === selectedStartDockId
        )
        const movingBoat = harborDockBoats.find((boat) => boat.dockId === selectedStartDockId)
        if (!startDock || !movingBoat) {
            return {
                status: 'idle',
                message: 'Select a harbor boat, then click a player board dock.'
            }
        }

        const occupiedBoatPoses = harborDockSlots
            .filter((slot) => slot.id !== startDock.id)
            .map((slot) => slot.dockedPose)
        const targetDock = boatNavigationGeometry.playerBoardDockSlots.find(
            (slot) => slot.id === selectedTargetDockId
        )
        if (!targetDock) {
            return {
                status: 'awaiting-target',
                startDockId: selectedStartDockId,
                message: 'Select a specific player board dock to test the route.'
            }
        }
        const startedAt = performance.now()
        const exactPlan = buildDockTransferPlan(
            startDock,
            targetDock,
            boatNavigationGeometry,
            occupiedBoatPoses
        )
        const elapsedMs = Math.round(performance.now() - startedAt)
        if (exactPlan) {
            return {
                status: 'success',
                startDockId: startDock.id,
                targetDockId: selectedTargetDockId,
                movingBoatColor: movingBoat.color,
                plan: exactPlan,
                message: `Route found from ${startDock.id} to ${selectedTargetDockId} in ${elapsedMs}ms.`
            }
        }

        return {
            status: 'failed',
            startDockId: startDock.id,
            targetDockId: selectedTargetDockId,
            message: `No route found from ${startDock.id} to ${selectedTargetDockId} in ${elapsedMs}ms.`
        }
    })
    const routeProbeLength = $derived.by(() =>
        routeProbe.status === 'success' ? getMotionPathLength(routeProbe.plan.segments) : 0
    )
    const movingBoat = $derived.by(() => {
        if (routeProbe.status !== 'success' || routeProbeLength <= 0) {
            return null
        }

        const speed = 170
        const traveled = ((demoAnimationMs / 1000) * speed) % routeProbeLength
        const pose = sampleMotionPath(routeProbe.plan.segments, traveled)

        return {
            x: pose.x - BOAT_WIDTH / 2,
            y: pose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
            rotation: boatHeadingToRenderRotation(pose.heading),
            color: routeProbe.movingBoatColor
        }
    })

    function handleHarborBoatClick(dockId: string) {
        selectedStartDockId = dockId
        selectedTargetDockId = null
        demoAnimationMs = 0
    }

    function handlePlayerBoardDockClick(dockId: string) {
        if (!selectedStartDockId) {
            return
        }

        selectedTargetDockId = dockId
        demoAnimationMs = 0
    }

    function getPlayerForState(playerState: ContainerPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)!
    }

    onMount(() => {
        let animationFrame = 0
        let startTime = 0

        const tick = (timestamp: number) => {
            if (startTime === 0) {
                startTime = timestamp
            }

            demoAnimationMs = timestamp - startTime
            animationFrame = requestAnimationFrame(tick)
        }

        animationFrame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(animationFrame)
    })
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
        >
            <BoardBaseLayer
                boardWidth={boardLayout.boardWidth}
                boardHeight={boardLayout.boardHeight}
                boardCornerRadius={boardLayout.boardCornerRadius}
                islandRect={boardLayout.islandRect}
                offshoreRect={boardLayout.offshoreRect}
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
            {#each harborDockBoats as boat (boat.key)}
                {#if routeProbe.status !== 'success' || routeProbe.startDockId !== boat.dockId}
                    <Boat x={boat.x} y={boat.y} color={boat.color} rotation={boat.rotation} />
                {/if}
                <rect
                    x={boat.x}
                    y={boat.y}
                    width={DEFAULT_BOAT_RENDER_WIDTH}
                    height={DEFAULT_BOAT_RENDER_HEIGHT}
                    fill="transparent"
                    class="cursor-pointer"
                    role="button"
                    tabindex="0"
                    aria-label={`Select harbor boat ${boat.dockId}`}
                    onclick={() => handleHarborBoatClick(boat.dockId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleHarborBoatClick(boat.dockId)
                        }
                    }}
                ></rect>
            {/each}
            {#if movingBoat}
                <Boat
                    x={movingBoat.x}
                    y={movingBoat.y}
                    color={movingBoat.color}
                    rotation={movingBoat.rotation}
                />
            {/if}
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
            {#each playerBoardDockTargets as dockTarget (dockTarget.dockId)}
                <rect
                    x={dockTarget.x}
                    y={dockTarget.y}
                    width={dockTarget.width}
                    height={dockTarget.height}
                    fill={selectedStartDockId ? 'rgba(255, 255, 255, 0.04)' : 'transparent'}
                    stroke={selectedStartDockId ? 'rgba(255, 255, 255, 0.32)' : 'transparent'}
                    stroke-width="2"
                    rx="10"
                    class:selected-dock-target={selectedTargetDockId === dockTarget.dockId}
                    class:target-dock-target={!!selectedStartDockId}
                    role="button"
                    tabindex="0"
                    aria-label={`Select player board dock ${dockTarget.dockId}`}
                    onclick={() => handlePlayerBoardDockClick(dockTarget.dockId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handlePlayerBoardDockClick(dockTarget.dockId)
                        }
                    }}
                ></rect>
            {/each}
        </svg>
        <div
            class="route-status-panel"
            style={`left:${ROUTE_STATUS_PANEL_X}px;top:${ROUTE_STATUS_PANEL_Y}px;`}
        >
            {routeProbe.message}
        </div>
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

    .route-status-panel {
        position: absolute;
        z-index: 2;
        max-width: 360px;
        border-radius: 14px;
        background: rgba(16, 19, 38, 0.82);
        padding: 10px 14px;
        color: #eef1ff;
        font-size: 15px;
        line-height: 1.35;
        box-shadow: 0 10px 28px rgba(7, 12, 34, 0.28);
        pointer-events: none;
    }

    .target-dock-target {
        cursor: pointer;
        transition:
            fill 120ms ease,
            stroke 120ms ease,
            opacity 120ms ease;
    }

    .target-dock-target:hover {
        fill: rgba(255, 255, 255, 0.09);
        stroke: rgba(255, 255, 255, 0.55);
    }

    .selected-dock-target {
        fill: rgba(255, 255, 255, 0.12);
        stroke: #ffffff;
    }
</style>
