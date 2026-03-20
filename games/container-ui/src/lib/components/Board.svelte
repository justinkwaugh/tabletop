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
    import {
        buildLargeConnectorPlacements,
        buildSideConnectorPlacements,
        connectorPlacementToSvgTransform
    } from '$lib/definitions/connectorGeometry.js'
    import { getMotionPathLength, sampleMotionPath } from '$lib/definitions/boatMotion.js'
    import { buildBoatNavigationGeometry } from '$lib/definitions/boatNavigation.js'
    import {
        getFilledRouteOccupiedBoatPoses,
        getFilledRouteOccupiedDockIds
    } from '$lib/definitions/boatRouteOccupancy.js'
    import {
        getPrecomputedBoatRoutePlanForGeometry
    } from '$lib/definitions/boatPrecomputedRoutes.js'
    import {
        buildRoutePlan,
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
    const ROUTE_STATUS_PANEL_X = 24
    const ROUTE_STATUS_PANEL_Y = 24
    const IDLE_ROUTE_MESSAGE =
        'Select any dock or ghost ship as the start, then any other position as the destination. All remaining positions are occupied.'
    const AWAITING_TARGET_MESSAGE =
        'Select a destination dock, harbor, or ghost ship to test the filled-position route.'

    let demoAnimationMs = $state(performance.now())
    let routeAnimationStartMs = $state(performance.now())
    let selectedStartSlotId = $state<string | null>(null)
    let selectedTargetSlotId = $state<string | null>(null)

    type PlayerAndState = { player: Player; playerState: HydratedContainerPlayerState }
    type RouteProbeState =
        | {
              status: 'idle'
              message: string
          }
        | {
              status: 'awaiting-target'
              message: string
              startSlotId: string
          }
        | {
              status: 'failed'
              message: string
              startSlotId: string
              targetSlotId: string
          }
          | {
              status: 'success'
              message: string
              startSlotId: string
              targetSlotId: string
              movingBoatColor: string
              plan: BoatRoutePlan
          }
    let routeProbe = $state<RouteProbeState>({
        status: 'idle',
        message: IDLE_ROUTE_MESSAGE
    })

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
    const allDockSlots = $derived.by(() => [
        ...boatNavigationGeometry.playerBoardDockSlots,
        ...boatNavigationGeometry.mainIslandDockSlots,
        ...boatNavigationGeometry.offshoreDockSlots
    ])
    const allRouteSlots = $derived.by(() => [
        ...allDockSlots,
        ...boatNavigationGeometry.openWaterSlots
    ])
    const harborDockSlots = $derived.by(() => [
        ...boatNavigationGeometry.mainIslandDockSlots,
        ...boatNavigationGeometry.offshoreDockSlots
    ])
    const routeColorById = $derived.by(() => {
        const colors = new Map<string, string>()

        harborDockSlots.forEach((slot, slotIndex) => {
            const player = playersAndStates[slotIndex % playersAndStates.length]
            colors.set(
                slot.id,
                player ? gameSession.colors.getPlayerUiColor(player.player.id) : '#84accf'
            )
        })

        boatNavigationGeometry.playerBoardDockSlots.forEach((slot) => {
            const playerId = slot.id.split('-dock-')[0]
            colors.set(slot.id, gameSession.colors.getPlayerUiColor(playerId))
        })

        boatNavigationGeometry.openWaterSlots.forEach((slot, slotIndex) => {
            const player = playersAndStates[slotIndex % playersAndStates.length]
            colors.set(
                slot.id,
                player ? gameSession.colors.getPlayerUiColor(player.player.id) : '#84accf'
            )
        })

        return colors
    })
    const routeFilledOccupiedSlotIds = $derived.by(() => {
        if (!selectedStartSlotId || !selectedTargetSlotId) {
            return new Set<string>()
        }

        return getFilledRouteOccupiedDockIds(allRouteSlots, [
            selectedStartSlotId,
            selectedTargetSlotId
        ])
    })

    const largeConnectorPlacements = $derived.by(() =>
        buildLargeConnectorPlacements(boardLayout.playerBoardSeats)
    )

    const sideConnectorPlacements = $derived.by(() =>
        buildSideConnectorPlacements(boardLayout.playerBoardSeats)
    )

    const crowdedDockBoats = $derived.by(() =>
        allDockSlots
            .filter((slot) => routeFilledOccupiedSlotIds.has(slot.id))
            .map((slot, slotIndex) => {
                return {
                    key: `crowded-dock-boat-${slot.id}`,
                    dockId: slot.id,
                    family: slot.family,
                    x: slot.dockedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
                    y: slot.dockedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                    rotation: boatHeadingToRenderRotation(slot.dockedPose.heading),
                    color: routeColorById.get(slot.id) ?? '#84accf'
                }
            })
    )
    const crowdedOpenWaterBoats = $derived.by(() =>
        boatNavigationGeometry.openWaterSlots
            .filter((slot) => routeFilledOccupiedSlotIds.has(slot.id))
            .map((slot) => ({
                key: `crowded-open-water-${slot.id}`,
                slotId: slot.id,
                x: slot.parkedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
                y: slot.parkedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                rotation: boatHeadingToRenderRotation(slot.parkedPose.heading),
                color: routeColorById.get(slot.id) ?? '#84accf'
            }))
    )
    const selectableHarborBoats = $derived.by(() =>
        harborDockSlots.map((slot, slotIndex) => {
                return {
                    key: `harbor-dock-boat-${slot.id}`,
                    dockId: slot.id,
                    x: slot.dockedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
                    y: slot.dockedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                    rotation: boatHeadingToRenderRotation(slot.dockedPose.heading),
                    color: routeColorById.get(slot.id) ?? '#84accf'
                }
            })
    )
    const routeTargets = $derived.by(() =>
        allRouteSlots
            .map((slot) => ({
                slotId: slot.id,
                x: ('dockedPose' in slot ? slot.dockedPose.x : slot.parkedPose.x) - DEFAULT_BOAT_RENDER_WIDTH / 2,
                y: ('dockedPose' in slot ? slot.dockedPose.y : slot.parkedPose.y) - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                width: DEFAULT_BOAT_RENDER_WIDTH,
                height: DEFAULT_BOAT_RENDER_HEIGHT
            }))
    )
    const openWaterGhostBoats = $derived.by(() =>
        boatNavigationGeometry.openWaterSlots.map((slot, index) => ({
            key: slot.id,
            label: `${index + 1}`,
            slotId: slot.id,
            x: slot.parkedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
            y: slot.parkedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
            rotation: boatHeadingToRenderRotation(slot.parkedPose.heading),
            color: routeColorById.get(slot.id) ?? '#84accf'
        }))
    )

    const routeProbeLength = $derived.by(() =>
        routeProbe.status === 'success' ? getMotionPathLength(routeProbe.plan.segments) : 0
    )
    const movingBoat = $derived.by(() => {
        if (routeProbe.status !== 'success' || routeProbeLength <= 0) {
            return null
        }

        const speed = 170
        const animationElapsedMs = Math.max(0, demoAnimationMs - routeAnimationStartMs)
        const traveled = ((animationElapsedMs / 1000) * speed) % routeProbeLength
        const pose = sampleMotionPath(routeProbe.plan.segments, traveled)

        return {
            x: pose.x - BOAT_WIDTH / 2,
            y: pose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
            rotation: boatHeadingToRenderRotation(pose.heading),
            color: routeProbe.movingBoatColor
        }
    })

    function handleRouteSlotClick(slotId: string) {
        if (!selectedStartSlotId || selectedTargetSlotId) {
            selectedStartSlotId = slotId
            selectedTargetSlotId = null
            routeProbe = {
                status: 'awaiting-target',
                startSlotId: slotId,
                message: AWAITING_TARGET_MESSAGE
            }
        } else if (slotId === selectedStartSlotId) {
            selectedStartSlotId = null
            selectedTargetSlotId = null
            routeProbe = {
                status: 'idle',
                message: IDLE_ROUTE_MESSAGE
            }
        } else {
            const startSlot = allRouteSlots.find((slot) => slot.id === selectedStartSlotId)
            const targetSlot = allRouteSlots.find((slot) => slot.id === slotId)

            if (startSlot?.family === 'open-water' && targetSlot?.family === 'open-water') {
                routeProbe = {
                    status: 'failed',
                    startSlotId: startSlot.id,
                    targetSlotId: targetSlot.id,
                    message: 'Open-water holding positions cannot move directly to other open-water holding positions.'
                }
                return
            }

            selectedTargetSlotId = slotId
            const movingBoatColor = routeColorById.get(selectedStartSlotId)

            if (!startSlot || !targetSlot || !movingBoatColor) {
                selectedStartSlotId = null
                selectedTargetSlotId = null
                routeProbe = {
                    status: 'idle',
                    message: IDLE_ROUTE_MESSAGE
                }
                return
            }

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allRouteSlots, [
                startSlot.id,
                targetSlot.id
            ])
            const startedAt = performance.now()
            const precomputedPlan = getPrecomputedBoatRoutePlanForGeometry(
                boatNavigationGeometry,
                startSlot.id,
                targetSlot.id
            )
            const exactPlan =
                precomputedPlan ??
                buildRoutePlan(
                    startSlot,
                    targetSlot,
                    boatNavigationGeometry,
                    occupiedBoatPoses
                )
            const elapsedMs = Math.round(performance.now() - startedAt)
            const routeSource = precomputedPlan ? 'precomputed' : 'planned'

            if (exactPlan) {
                routeProbe = {
                    status: 'success',
                    startSlotId: startSlot.id,
                    targetSlotId: targetSlot.id,
                    movingBoatColor,
                    plan: exactPlan,
                    message: `Route found (${routeSource}) with all remaining positions occupied from ${startSlot.id} to ${targetSlot.id} in ${elapsedMs}ms.`
                }
                routeAnimationStartMs = performance.now()
            } else {
                routeProbe = {
                    status: 'failed',
                    startSlotId: startSlot.id,
                    targetSlotId: targetSlot.id,
                    message: `No route found (${routeSource}) with all remaining positions occupied from ${startSlot.id} to ${targetSlot.id} in ${elapsedMs}ms.`
                }
            }
        }
    }

    function getPlayerForState(playerState: ContainerPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)!
    }

    onMount(() => {
        let animationFrame = 0

        const tick = (timestamp: number) => {
            demoAnimationMs = timestamp
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
                <g transform={connectorPlacementToSvgTransform(connector)}>
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
                <g transform={connectorPlacementToSvgTransform(connector)}>
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
            {#each boatNavigationGeometry.transitChannels as channel (channel.id)}
                <g opacity="0.9" pointer-events="none">
                    <rect
                        x={channel.x - channel.width / 2}
                        y={channel.y - channel.height / 2}
                        width={channel.width}
                        height={channel.height}
                        rx="24"
                        fill="rgba(155, 229, 121, 0.14)"
                        stroke="rgba(155, 229, 121, 0.88)"
                        stroke-width="4"
                        stroke-dasharray="18 12"
                    ></rect>
                    <text
                        x={channel.x}
                        y={channel.y + 6}
                        text-anchor="middle"
                        font-size="18"
                        font-weight="700"
                        fill="rgba(201, 248, 178, 0.95)"
                    >
                        {channel.id}
                    </text>
                </g>
            {/each}
            {#each openWaterGhostBoats as boat (boat.key)}
                {#if !routeFilledOccupiedSlotIds.has(boat.slotId)
                    && selectedStartSlotId !== boat.slotId
                    && selectedTargetSlotId !== boat.slotId}
                    <g opacity="0.45">
                        <Boat x={boat.x} y={boat.y} color={boat.color} rotation={boat.rotation} />
                        <text
                            x={boat.x + DEFAULT_BOAT_RENDER_WIDTH / 2}
                            y={boat.y + DEFAULT_BOAT_RENDER_HEIGHT + 22}
                            text-anchor="middle"
                            font-size="18"
                            font-weight="700"
                            fill="#3e4954"
                        >
                            {boat.label}
                        </text>
                    </g>
                {/if}
            {/each}
            {#each crowdedOpenWaterBoats as boat (boat.key)}
                {#if routeProbe.status !== 'success' || routeProbe.startSlotId !== boat.slotId}
                    <g opacity="0.92">
                        <Boat x={boat.x} y={boat.y} color={boat.color} rotation={boat.rotation} />
                    </g>
                {/if}
            {/each}
            {#each crowdedDockBoats as boat (boat.key)}
                {#if routeProbe.status !== 'success' || routeProbe.startSlotId !== boat.dockId}
                    <g opacity="0.92">
                        <Boat x={boat.x} y={boat.y} color={boat.color} rotation={boat.rotation} />
                    </g>
                {/if}
            {/each}
            {#each selectableHarborBoats as boat (boat.key)}
                <rect
                    x={boat.x}
                    y={boat.y}
                    width={DEFAULT_BOAT_RENDER_WIDTH}
                    height={DEFAULT_BOAT_RENDER_HEIGHT}
                    fill="transparent"
                    class="cursor-pointer"
                    role="button"
                    tabindex="0"
                    aria-label={`Select position ${boat.dockId}`}
                    onclick={() => handleRouteSlotClick(boat.dockId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleRouteSlotClick(boat.dockId)
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
            {#each routeTargets as routeTarget (routeTarget.slotId)}
                <rect
                    x={routeTarget.x}
                    y={routeTarget.y}
                    width={routeTarget.width}
                    height={routeTarget.height}
                    fill={selectedStartSlotId ? 'rgba(255, 255, 255, 0.04)' : 'transparent'}
                    stroke={selectedStartSlotId ? 'rgba(255, 255, 255, 0.32)' : 'transparent'}
                    stroke-width="2"
                    rx="10"
                    class:selected-start-dock={selectedStartSlotId === routeTarget.slotId}
                    class:selected-dock-target={selectedTargetSlotId === routeTarget.slotId}
                    class:target-dock-target={selectedStartSlotId !== routeTarget.slotId}
                    role="button"
                    tabindex="0"
                    aria-label={`Select position ${routeTarget.slotId}`}
                    onclick={() => handleRouteSlotClick(routeTarget.slotId)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleRouteSlotClick(routeTarget.slotId)
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

    .selected-start-dock {
        fill: rgba(255, 255, 255, 0.1);
        stroke: rgba(255, 255, 255, 0.8);
    }
</style>
