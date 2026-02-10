<script lang="ts">
    import { isSiteId, type BuildingSiteId, type BusNodeId } from '@tabletop/bus'
    import BuildingSiteHighlight from './BuildingSiteHighlight.svelte'
    import Passenger from './Passenger.svelte'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import boardImg from '$lib/images/bus_board.jpg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300

    // This is mildly more efficient than iterating by node and calculating passengers for each node.
    let passengersByNodeId = $derived.by(() => {
        return gameSession.gameState.board.passengersByNode()
    })

    let highlightedBuildingSiteIds: BuildingSiteId[] = $derived.by(() => {
        return gameSession.gameState.board
            .openSitesForPhase(gameSession.gameState.currentBuildingPhase)
            .map((site) => site.id)
            .filter((siteId) => isSiteId(siteId))
    })

    let selectedBuildingSiteId = $state<BuildingSiteId | undefined>()

    function handleBuildingSiteChoose(siteId: BuildingSiteId) {
        selectedBuildingSiteId = siteId
    }
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1300px] w-[1839px]">
        <img src={boardImg} alt="game board" class="board-image absolute inset-0 h-full w-full" />
        <svg
            class="absolute inset-0 h-full w-full"
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

            {#each highlightedBuildingSiteIds as siteId (siteId)}
                <BuildingSiteHighlight
                    {siteId}
                    isSelected={siteId === selectedBuildingSiteId}
                    onChoose={handleBuildingSiteChoose}
                />
            {/each}

            {#each Object.entries(passengersByNodeId) as [nodeId, passengers] (nodeId)}
                {@const point = BUS_BOARD_NODE_POINTS[nodeId as BusNodeId]}
                <Passenger x={point.x} y={point.y} count={passengers.length} />
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
