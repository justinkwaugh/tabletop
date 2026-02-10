<script lang="ts">
    import { BUS_STATION_IDS, type BusNodeId } from '@tabletop/bus'
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

<div class="board-shell">
    <div class="board-surface relative h-[1300px] w-[1839px]">
        <img src={boardImg} alt="game board" class="board-image absolute inset-0 h-full w-full" />
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
