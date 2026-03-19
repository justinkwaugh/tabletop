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
    import { buildDockTransferPlan } from '$lib/definitions/boatPlanner.js'
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

    let demoAnimationMs = $state(0)

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

    const islandDockBoats = $derived.by(() => {
        return boatNavigationGeometry.mainIslandDockSlots.slice(1).map((slot, slotIndex) => {
            const index = slotIndex + 1
            const player = playersAndStates[index % playersAndStates.length]
            const color = player
                ? gameSession.colors.getPlayerUiColor(player.player.id)
                : '#84accf'

            return {
                key: `island-dock-boat-${index}`,
                x: slot.dockedPose.x - DEFAULT_BOAT_RENDER_WIDTH / 2,
                y: slot.dockedPose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
                rotation: boatHeadingToRenderRotation(slot.dockedPose.heading),
                color
            }
        })
    })
    const demoRoutePlan = $derived.by(() => {
        for (const [startIndex, startDock] of boatNavigationGeometry.mainIslandDockSlots.entries()) {
            const occupiedBoatPoses = boatNavigationGeometry.mainIslandDockSlots
                .filter((_, index) => index !== startIndex)
                .map((slot) => slot.dockedPose)

            for (const endDock of boatNavigationGeometry.playerBoardDockSlots) {
                const plan = buildDockTransferPlan(
                    startDock,
                    endDock,
                    boatNavigationGeometry,
                    occupiedBoatPoses
                )
                if (plan) {
                    return plan
                }
            }
        }

        return null
    })
    const demoRouteLength = $derived.by(() =>
        demoRoutePlan ? getMotionPathLength(demoRoutePlan.segments) : 0
    )
    const demoBoat = $derived.by(() => {
        if (!demoRoutePlan || demoRouteLength <= 0) {
            return null
        }

        const speed = 170
        const traveled = ((demoAnimationMs / 1000) * speed) % demoRouteLength
        const pose = sampleMotionPath(demoRoutePlan.segments, traveled)

        return {
            x: pose.x - BOAT_WIDTH / 2,
            y: pose.y - DEFAULT_BOAT_RENDER_HEIGHT / 2,
            rotation: boatHeadingToRenderRotation(pose.heading),
            color:
                playersAndStates[0] ?
                    gameSession.colors.getPlayerUiColor(playersAndStates[0].player.id)
                :   '#84accf'
        }
    })

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
            {#each islandDockBoats as boat (boat.key)}
                <Boat x={boat.x} y={boat.y} color={boat.color} rotation={boat.rotation} />
            {/each}
            {#if demoBoat}
                <Boat
                    x={demoBoat.x}
                    y={demoBoat.y}
                    color={demoBoat.color}
                    rotation={demoBoat.rotation}
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
