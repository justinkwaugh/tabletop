<script lang="ts">
    import {
        ActionType,
        BUS_STATION_IDS,
        isSiteId,
        type BuildingSiteId,
        type BusNodeId,
        type BusStationId
    } from '@tabletop/bus'
    import BuildingSiteHighlight from './BuildingSiteHighlight.svelte'
    import Passenger from './Passenger.svelte'
    import StationSelectionHighlight from './StationSelectionHighlight.svelte'
    import {
        AddPassengersPlacementAnimator,
        animateStationPassenger
    } from '$lib/animators/addPassengersPlacementAnimator.js'
    import { PassengerReturnAnimator } from '$lib/animators/passengerReturnAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { PassengerDeliveryAnimator } from '$lib/animators/passengerDeliveryAnimator.js'
    import { BUS_BOARD_NODE_POINTS, BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const SITE_PASSENGER_HEIGHT = 44
    const NODE_PASSENGER_HEIGHT = 74
    const VROOM_SOURCE_HOVER_PASSENGER_HEIGHT = 80
    const NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY = 0.5
    const VROOM_PASSENGER_HIT_RADIUS = 34

    type SitePassengerPlacement = {
        id: string
        siteId: BuildingSiteId
    }

    type DeliveringPassengerPose = {
        id: string
        sourceNodeId: BusNodeId
        destinationSiteId: BuildingSiteId
        x: number
        y: number
        height: number
    }

    type ReturningPassengerPose = {
        id: string
        sourceSiteId: BuildingSiteId
        destinationNodeId: BusNodeId
        x: number
        y: number
        height: number
    }

    let hoveredVroomSourceNodeId: BusNodeId | undefined = $state()
    let animatedDeliveringPassengers: Map<string, DeliveringPassengerPose> | undefined = $derived.by(
        () => {
            gameSession.gameState
            return undefined
        }
    )
    let stationPassengerCountOverrides: Map<BusNodeId, number> | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedReturningPassengers: Map<string, ReturningPassengerPose> | undefined = $derived.by(
        () => {
            gameSession.gameState
            return undefined
        }
    )

    const animatedDeliveringPassengerIds = $derived.by(() => {
        return new Set(animatedDeliveringPassengers?.keys() ?? [])
    })

    const animatedDeliveringPassengerList = $derived.by(() => {
        return animatedDeliveringPassengers ? [...animatedDeliveringPassengers.values()] : []
    })

    const animatedDeliveringPassengerSourceCountByNodeId = $derived.by(() => {
        const counts = new Map<BusNodeId, number>()
        for (const passenger of animatedDeliveringPassengers?.values() ?? []) {
            counts.set(passenger.sourceNodeId, (counts.get(passenger.sourceNodeId) ?? 0) + 1)
        }
        return counts
    })

    const animatedReturningPassengerIds = $derived.by(() => {
        return new Set(animatedReturningPassengers?.keys() ?? [])
    })

    const animatedReturningPassengerList = $derived.by(() => {
        return animatedReturningPassengers ? [...animatedReturningPassengers.values()] : []
    })

    const passengersByNodeId = $derived.by(() => {
        return gameSession.gameState.board.passengersByNode()
    })

    const nodePassengerEntries = $derived.by(() => {
        const keys = new Set<BusNodeId>()

        for (const nodeId of Object.keys(passengersByNodeId)) {
            keys.add(nodeId as BusNodeId)
        }

        for (const nodeId of stationPassengerCountOverrides?.keys() ?? []) {
            keys.add(nodeId)
        }

        return [...keys].map((nodeId) => ({
            nodeId,
            passengers: passengersByNodeId[nodeId] ?? []
        }))
    })

    const passengersAtSite: SitePassengerPlacement[] = $derived.by(() => {
        const placements: SitePassengerPlacement[] = []
        for (const passenger of gameSession.gameState.board.passengers) {
            if (!passenger.siteId || !isSiteId(passenger.siteId)) {
                continue
            }
            placements.push({
                id: passenger.id,
                siteId: passenger.siteId
            })
        }
        return placements
    })

    const highlightedBuildingSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (gameSession.isViewingHistory || !gameSession.isMyTurn) {
            return []
        }

        if (!gameSession.isInitialBuildingPlacement && !gameSession.isAddingBuildings) {
            return []
        }

        const pendingBuildingSiteId = gameSession.pendingBuildingSiteId
        const openSiteIds = gameSession.gameState.board
            .openSitesForPhase(gameSession.gameState.currentBuildingPhase)
            .map((site) => site.id)
            .filter((siteId): siteId is BuildingSiteId => isSiteId(siteId))

        if (!pendingBuildingSiteId) {
            return openSiteIds
        }

        return openSiteIds.filter((siteId) => siteId !== pendingBuildingSiteId)
    })

    const chosenBuildingSiteId = $derived.by(() => {
        const chosenSite = gameSession.chosenSite
        if (!chosenSite || !isSiteId(chosenSite)) {
            return undefined
        }
        return chosenSite
    })

    const highlightedPassengerStationIds: BusStationId[] = $derived.by(() => {
        if (
            gameSession.isViewingHistory ||
            !gameSession.isMyTurn ||
            !gameSession.validActionTypes.includes(ActionType.AddPassengers)
        ) {
            return []
        }
        return [...BUS_STATION_IDS]
    })

    const chosenPassengerStationId: BusStationId | undefined = $derived.by(() => {
        return gameSession.chosenPassengerStationId
    })

    const chosenVroomSourceNodeId: BusNodeId | undefined = $derived.by(() => {
        return gameSession.chosenVroomSourceNodeId
    })

    const highlightedVroomSourceNodeIds: BusNodeId[] = $derived.by(() => {
        if (gameSession.isViewingHistory || !gameSession.isMyTurn) {
            return []
        }
        if (chosenVroomSourceNodeId) {
            return []
        }
        return gameSession.deliverableVroomSourceNodeIds
    })

    const highlightedVroomDestinationSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (gameSession.isViewingHistory || !gameSession.isMyTurn) {
            return []
        }
        if (!chosenVroomSourceNodeId) {
            return []
        }
        return gameSession.vroomDestinationSiteIds
    })

    const isChoosingVroomSourcePassenger = $derived.by(() => {
        return (
            !gameSession.isViewingHistory &&
            gameSession.canVroom &&
            highlightedVroomSourceNodeIds.length > 0
        )
    })

    const shouldMaskUnselectedVroomPassengers = $derived.by(() => {
        return !gameSession.isViewingHistory && (isChoosingVroomSourcePassenger || !!chosenVroomSourceNodeId)
    })

    const passengerDeliveryAnimator = new PassengerDeliveryAnimator(gameSession, {
        onStart: (passengers) => {
            const next = new Map(animatedDeliveringPassengers ?? [])
            for (const passenger of passengers) {
                next.set(passenger.id, {
                    id: passenger.id,
                    sourceNodeId: passenger.sourceNodeId,
                    destinationSiteId: passenger.destinationSiteId,
                    x: passenger.pose.x,
                    y: passenger.pose.y,
                    height: passenger.pose.height
                })
            }
            animatedDeliveringPassengers = next
        },
        onUpdate: (passengerId, pose) => {
            const existing = animatedDeliveringPassengers?.get(passengerId)
            if (!existing || !animatedDeliveringPassengers) {
                return
            }

            const next = new Map(animatedDeliveringPassengers)
            next.set(passengerId, {
                ...existing,
                x: pose.x,
                y: pose.y,
                height: pose.height
            })
            animatedDeliveringPassengers = next
        },
        onComplete: (passengerId) => {
            if (!animatedDeliveringPassengers) {
                return
            }

            const next = new Map(animatedDeliveringPassengers)
            next.delete(passengerId)
            animatedDeliveringPassengers = next.size > 0 ? next : undefined
        }
    })

    const addPassengersPlacementAnimator = new AddPassengersPlacementAnimator(gameSession, {
        onPrepareCount: ({ nodeId, count }) => {
            const next = new Map(stationPassengerCountOverrides ?? [])
            next.set(nodeId, count)
            stationPassengerCountOverrides = next
        }
    })

    const passengerReturnAnimator = new PassengerReturnAnimator(gameSession, {
        onStart: (passengers) => {
            const next = new Map<string, ReturningPassengerPose>()
            for (const passenger of passengers) {
                next.set(passenger.id, {
                    id: passenger.id,
                    sourceSiteId: passenger.sourceSiteId,
                    destinationNodeId: passenger.destinationNodeId,
                    x: passenger.pose.x,
                    y: passenger.pose.y,
                    height: passenger.pose.height
                })
            }
            animatedReturningPassengers = next
        },
        onUpdate: (passengerId, pose) => {
            const existing = animatedReturningPassengers?.get(passengerId)
            if (!existing || !animatedReturningPassengers) {
                return
            }

            const next = new Map(animatedReturningPassengers)
            next.set(passengerId, {
                ...existing,
                x: pose.x,
                y: pose.y,
                height: pose.height
            })
            animatedReturningPassengers = next
        }
    })

    function handleBuildingSiteChoose(siteId: BuildingSiteId) {
        gameSession.chosenSite = siteId
    }

    function handlePassengerStationChoose(stationId: BusStationId) {
        gameSession.chosenPassengerStationId = stationId
    }

    function handleVroomSourceNodeChoose(nodeId: BusNodeId) {
        gameSession.chooseVroomSourceNode(nodeId)
    }

    function handleVroomDestinationSiteChoose(siteId: BuildingSiteId) {
        void gameSession.chooseVroomDestinationSite(siteId)
    }

    function handleActivateFromKeyboard(event: KeyboardEvent, action: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
            return
        }
        event.preventDefault()
        action()
    }
</script>

{#each highlightedBuildingSiteIds as siteId (siteId)}
    <BuildingSiteHighlight
        {siteId}
        isSelected={siteId === chosenBuildingSiteId}
        onChoose={handleBuildingSiteChoose}
    />
{/each}

{#each highlightedVroomDestinationSiteIds as siteId (siteId)}
    <BuildingSiteHighlight {siteId} onChoose={handleVroomDestinationSiteChoose} />
{/each}

{#each highlightedPassengerStationIds as stationId (stationId)}
    <StationSelectionHighlight
        {stationId}
        isSelected={stationId === chosenPassengerStationId}
        onChoose={handlePassengerStationChoose}
    />
{/each}

<g class="pointer-events-none" {@attach attachAnimator(passengerDeliveryAnimator)}></g>
<g class="pointer-events-none" {@attach attachAnimator(addPassengersPlacementAnimator)}></g>
<g class="pointer-events-none" {@attach attachAnimator(passengerReturnAnimator)}></g>

{#each nodePassengerEntries as entry (entry.nodeId)}
    {@const typedNodeId = entry.nodeId}
    {@const point = BUS_BOARD_NODE_POINTS[typedNodeId]}
    {@const isChosenVroomSource = chosenVroomSourceNodeId === typedNodeId}
    {@const isSelectableVroomSource = highlightedVroomSourceNodeIds.includes(typedNodeId)}
    {@const isHoveredSelectableVroomSource =
        isSelectableVroomSource &&
        !isChosenVroomSource &&
        hoveredVroomSourceNodeId === typedNodeId}
    {@const animatedDeliverySourceCount =
        animatedDeliveringPassengerSourceCountByNodeId.get(typedNodeId) ?? 0}
    {@const deliveryAdjustedPassengerCount =
        Math.max(0, entry.passengers.length - animatedDeliverySourceCount)}
    {@const overridePassengerCount = stationPassengerCountOverrides?.get(typedNodeId)}
    {@const displayPassengerCount = overridePassengerCount ?? deliveryAdjustedPassengerCount}
    {@const shouldMaskForVroom =
        shouldMaskUnselectedVroomPassengers &&
        !(isSelectableVroomSource || isChosenVroomSource)}
    {#if displayPassengerCount > 0}
        <g
            transform={`translate(${point.x} ${point.y})`}
            use:animateStationPassenger={{ animator: addPassengersPlacementAnimator, nodeId: typedNodeId }}
        >
            <Passenger
                x={0}
                y={0}
                height={isHoveredSelectableVroomSource
                    ? VROOM_SOURCE_HOVER_PASSENGER_HEIGHT
                    : NODE_PASSENGER_HEIGHT}
                count={displayPassengerCount}
                maskOpacity={shouldMaskForVroom ? NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY : 0}
            />
        </g>
    {/if}
    {#if isChoosingVroomSourcePassenger && (isSelectableVroomSource || isChosenVroomSource)}
        <circle
            cx={point.x}
            cy={point.y}
            r={VROOM_PASSENGER_HIT_RADIUS}
            fill="transparent"
            class="cursor-pointer passenger-source-hit-target"
            role="button"
            tabindex="0"
            aria-label={`Choose passenger at ${typedNodeId}`}
            onmouseenter={() => (hoveredVroomSourceNodeId = typedNodeId)}
            onmouseleave={() => {
                if (hoveredVroomSourceNodeId === typedNodeId) {
                    hoveredVroomSourceNodeId = undefined
                }
            }}
            onkeydown={(event) =>
                handleActivateFromKeyboard(event, () => handleVroomSourceNodeChoose(typedNodeId))}
            onclick={() => handleVroomSourceNodeChoose(typedNodeId)}
        ></circle>
    {/if}
{/each}

{#each passengersAtSite as passenger (passenger.id)}
    {@const point = BUS_BUILDING_SITE_POINTS[passenger.siteId]}
    {#if !animatedDeliveringPassengerIds.has(passenger.id) && !animatedReturningPassengerIds.has(passenger.id)}
        <Passenger x={point.x} y={point.y} height={SITE_PASSENGER_HEIGHT} />
    {/if}
{/each}

{#each animatedDeliveringPassengerList as passenger (passenger.id)}
    <Passenger x={passenger.x} y={passenger.y} height={passenger.height} />
{/each}

{#each animatedReturningPassengerList as passenger (passenger.id)}
    <Passenger x={passenger.x} y={passenger.y} height={passenger.height} />
{/each}

<style>
    .passenger-source-hit-target:focus {
        outline: none;
    }

    .passenger-source-hit-target:focus-visible {
        outline: 2.5px solid #fff27a;
        outline-offset: 2px;
    }
</style>
