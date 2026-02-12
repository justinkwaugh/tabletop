<script lang="ts">
    import { type Point } from '@tabletop/common'
    import { isSiteId, type BusStationId } from '@tabletop/bus'
    import AddPassengersPicker from './AddPassengersPicker.svelte'
    import BoardActionRows from './BoardActionRows.svelte'
    import BoardClockAndTimeStones from './BoardClockAndTimeStones.svelte'
    import BoardMetaMarkers from './BoardMetaMarkers.svelte'
    import BoardPassengersOverlay from './BoardPassengersOverlay.svelte'
    import BoardPlacedBuildings from './BoardPlacedBuildings.svelte'
    import BuildingTypePicker from './BuildingTypePicker.svelte'
    import BusLineLayer from './BusLineLayer.svelte'
    import {
        BUS_BOARD_NODE_POINTS,
        BUS_BUILDING_SITE_POINTS
    } from '$lib/definitions/busBoardGraph.js'
    import boardImg from '$lib/images/bus_board.jpg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300

    const chosenBuildingSiteId = $derived.by(() => {
        const chosenSite = gameSession.chosenSite
        if (!chosenSite || !isSiteId(chosenSite)) {
            return undefined
        }
        return chosenSite
    })

    const chosenPassengerStationId: BusStationId | undefined = $derived.by(() => {
        return gameSession.chosenPassengerStationId
    })

    const buildingTypePickerPoint: Point = $derived.by(() => {
        if (!chosenBuildingSiteId) {
            return { x: 0, y: 0 }
        }
        return BUS_BUILDING_SITE_POINTS[chosenBuildingSiteId]
    })

    const addPassengersPickerPoint: Point = $derived.by(() => {
        if (!chosenPassengerStationId) {
            return { x: 0, y: 0 }
        }
        return BUS_BOARD_NODE_POINTS[chosenPassengerStationId]
    })
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1300px] w-[1839px]">
        <img src={boardImg} alt="game board" class="board-image absolute inset-0 h-full w-full" />
        <BusLineLayer />
        <svg
            class="absolute inset-0 z-[2] h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Passenger overlay"
        >
            <defs>
                <filter id="textshadow" x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="shadow"
                    ></feGaussianBlur>
                    <feOffset dx="2" dy="2"></feOffset>
                </filter>
            </defs>

            <g
                id="bus-building-picker-ref"
                style="transform:translate({buildingTypePickerPoint.x}px, {buildingTypePickerPoint.y}px);"
            >
                <rect width="1" height="1" fill="transparent"></rect>
            </g>
            <g
                id="bus-add-passengers-picker-ref"
                style="transform:translate({addPassengersPickerPoint.x}px, {addPassengersPickerPoint.y}px);"
            >
                <rect width="1" height="1" fill="transparent"></rect>
            </g>

            <BoardClockAndTimeStones />
            <BoardPlacedBuildings />
            <BoardMetaMarkers />
            <BoardActionRows />
            <BoardPassengersOverlay />
        </svg>

        {#if chosenBuildingSiteId}
            <BuildingTypePicker />
        {/if}
        {#if chosenPassengerStationId}
            <AddPassengersPicker />
        {/if}
    </div>
</div>

<style>
    .board-shell {
        position: relative;
        display: inline-flex;
        padding: 10px;
        border-radius: 20px;
        background:
            radial-gradient(980px 620px at 14% 10%, rgba(255, 255, 255, 0.4), transparent 64%),
            repeating-linear-gradient(
                -30deg,
                rgba(126, 134, 148, 0.018) 0 2px,
                rgba(255, 255, 255, 0.015) 2px 7px
            ),
            #eceae4;
    }

    .board-surface {
        border-radius: 14px;
        overflow: hidden;
        box-shadow:
            0 0 0 5px rgba(123, 131, 146, 0.24),
            0 10px 22px rgba(17, 24, 39, 0.12);
    }

    .board-image {
        filter: none;
    }
</style>
