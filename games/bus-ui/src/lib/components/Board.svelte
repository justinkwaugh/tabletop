<script lang="ts">
    import { BUS_STATION_IDS, type BusNodeId } from '@tabletop/bus'
    import DebugOverlay from './DebugOverlay.svelte'
    import Passenger from './Passenger.svelte'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import boardImg from '$lib/images/bus_board.jpg'

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300
    const stationNodeIds = BUS_STATION_IDS
    const stationNodeIdSet = new Set<BusNodeId>(stationNodeIds)
    const nonStationNodeIds = (Object.keys(BUS_BOARD_NODE_POINTS) as BusNodeId[]).filter(
        (nodeId) => !stationNodeIdSet.has(nodeId)
    )
    const randomPassengerNodeIds = pickRandomNodeIds(nonStationNodeIds, 3)

    function pickRandomNodeIds(nodeIds: readonly BusNodeId[], count: number): BusNodeId[] {
        const shuffled = [...nodeIds]

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1))
            ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
        }

        return shuffled.slice(0, Math.min(count, shuffled.length))
    }
</script>

<div class="relative h-[1300px] w-[1839px] bg-black">
    <img src={boardImg} alt="game board" class="absolute inset-0 h-full w-full" />
    <DebugOverlay />
    <svg
        class="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        aria-label="Passenger overlay"
    >
        <defs>
            <filter id="textshadow" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="shadow"></feGaussianBlur>
                <feOffset dx="2" dy="2"></feOffset>
            </filter>
        </defs>
        {#each stationNodeIds as nodeId (nodeId)}
            {@const point = BUS_BOARD_NODE_POINTS[nodeId]}
            <Passenger x={point.x} y={point.y} count="5" />
        {/each}
        {#each randomPassengerNodeIds as nodeId (nodeId)}
            {@const point = BUS_BOARD_NODE_POINTS[nodeId]}
            <Passenger x={point.x} y={point.y} count="2" />
        {/each}
    </svg>
</div>
