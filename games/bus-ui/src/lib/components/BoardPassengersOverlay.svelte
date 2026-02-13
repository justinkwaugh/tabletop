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
    import { AddPassengersPlacementAnimator } from '$lib/animators/addPassengersPlacementAnimator.js'
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

    type PassengerPose = {
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
    let animatedPassengerPose: PassengerPose | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedPassengerSourceNodeId: BusNodeId | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedPassengerDestinationSiteId: BuildingSiteId | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedAddedPassengersPose: PassengerPose | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedAddedPassengersNodeId: BusNodeId | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedAddedPassengersCount: number | undefined = $derived.by(() => {
        gameSession.gameState
        return undefined
    })
    let animatedReturningPassengers: Map<string, ReturningPassengerPose> | undefined = $derived.by(
        () => {
            gameSession.gameState
            return undefined
        }
    )

    const passengerDeliveryAnimator = new PassengerDeliveryAnimator(gameSession, {
        onStart: ({ sourceNodeId, destinationSiteId, pose }) => {
            animatedPassengerSourceNodeId = sourceNodeId
            animatedPassengerDestinationSiteId = destinationSiteId
            animatedPassengerPose = { ...pose }
        },
        onUpdate: (pose) => {
            animatedPassengerPose = { ...pose }
        }
    })

    const addPassengersPlacementAnimator = new AddPassengersPlacementAnimator(gameSession, {
        onStart: ({ nodeId, count, pose }) => {
            animatedAddedPassengersNodeId = nodeId
            animatedAddedPassengersCount = count
            animatedAddedPassengersPose = { ...pose }
        },
        onUpdate: (pose) => {
            animatedAddedPassengersPose = { ...pose }
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

    const passengersByNodeId = $derived.by(() => {
        return gameSession.gameState.board.passengersByNode()
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

    const animatedReturningPassengerIds = $derived.by(() => {
        return new Set(animatedReturningPassengers?.keys() ?? [])
    })

    const animatedReturningPassengerList = $derived.by(() => {
        return animatedReturningPassengers ? [...animatedReturningPassengers.values()] : []
    })

    const highlightedBuildingSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (gameSession.isViewingHistory) {
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
        if (gameSession.isViewingHistory) {
            return []
        }
        if (chosenVroomSourceNodeId) {
            return []
        }
        return gameSession.deliverableVroomSourceNodeIds
    })

    const highlightedVroomDestinationSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (gameSession.isViewingHistory) {
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

{#each Object.entries(passengersByNodeId) as [nodeId, passengers] (nodeId)}
    {@const typedNodeId = nodeId as BusNodeId}
    {@const point = BUS_BOARD_NODE_POINTS[typedNodeId]}
    {@const isChosenVroomSource = chosenVroomSourceNodeId === typedNodeId}
    {@const isSelectableVroomSource = highlightedVroomSourceNodeIds.includes(typedNodeId)}
    {@const isHoveredSelectableVroomSource =
        isSelectableVroomSource &&
        !isChosenVroomSource &&
        hoveredVroomSourceNodeId === typedNodeId}
    {@const deliveryAdjustedPassengerCount =
        animatedPassengerPose && animatedPassengerSourceNodeId === typedNodeId
            ? Math.max(0, passengers.length - 1)
            : passengers.length}
    {@const animatedPassengerCount =
        animatedAddedPassengersPose && animatedAddedPassengersNodeId === typedNodeId
            ? 0
            : deliveryAdjustedPassengerCount}
    {@const shouldMaskForVroom =
        shouldMaskUnselectedVroomPassengers &&
        !(isSelectableVroomSource || isChosenVroomSource)}
    {#if animatedPassengerCount > 0}
        <Passenger
            x={point.x}
            y={point.y}
            height={isHoveredSelectableVroomSource
                ? VROOM_SOURCE_HOVER_PASSENGER_HEIGHT
                : NODE_PASSENGER_HEIGHT}
            count={animatedPassengerCount}
            maskOpacity={shouldMaskForVroom ? NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY : 0}
        />
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
    {#if !(animatedPassengerPose && passenger.siteId === animatedPassengerDestinationSiteId) && !animatedReturningPassengerIds.has(passenger.id)}
        <Passenger x={point.x} y={point.y} height={SITE_PASSENGER_HEIGHT} />
    {/if}
{/each}

{#if animatedPassengerPose}
    <Passenger
        x={animatedPassengerPose.x}
        y={animatedPassengerPose.y}
        height={animatedPassengerPose.height}
    />
{/if}

{#if animatedAddedPassengersPose && animatedAddedPassengersNodeId && animatedAddedPassengersCount}
    <Passenger
        x={animatedAddedPassengersPose.x}
        y={animatedAddedPassengersPose.y}
        height={animatedAddedPassengersPose.height}
        count={animatedAddedPassengersCount}
    />
{/if}

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
