<script lang="ts">
    import boardImg from '$lib/images/indo_map_sm.jpg'
    import BoardActionAreasLayer from '$lib/components/BoardActionAreasLayer.svelte'
    import BoardCitiesLayer from '$lib/components/BoardCitiesLayer.svelte'
    import BoardCultivatedAreasLayer from '$lib/components/BoardCultivatedAreasLayer.svelte'
    import BoardDeedsLayer from '$lib/components/BoardDeedsLayer.svelte'
    import BoardProductionZoneMarkersLayer from '$lib/components/BoardProductionZoneMarkersLayer.svelte'
    import BoardResearchLayer from '$lib/components/BoardResearchLayer.svelte'
    import BoardShippingRouteOverlayLayer from '$lib/components/BoardShippingRouteOverlayLayer.svelte'
    import BoardShipsLayer from '$lib/components/BoardShipsLayer.svelte'
    import BoardTurnOrderLayer from '$lib/components/BoardTurnOrderLayer.svelte'
    import BoardDebugOverlay from '$lib/components/BoardDebugOverlay.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const SHOW_DEBUG_GEOMETRY = true

    const gameSession = getGameSession()
    let debugOverlayActive = $state(false)
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1280px] w-[2646px]">
        <img
            src={boardImg}
            alt="Indonesia game board"
            class="board-image absolute inset-0 h-full w-full"
        />
        <svg
            class="absolute inset-0 z-[1] h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Indonesia board state layer"
        >
            {#if !debugOverlayActive}
                <BoardDeedsLayer />
                <BoardShippingRouteOverlayLayer />
                <BoardCultivatedAreasLayer />
                <BoardProductionZoneMarkersLayer />
                <BoardShipsLayer />
                <BoardCitiesLayer />
                <BoardActionAreasLayer />
                <BoardTurnOrderLayer
                    selectedPlayerId={
                        gameSession.researchSelectionEnabled ? gameSession.selectedResearchPlayerId : null
                    }
                    selectable={gameSession.researchSelectionEnabled}
                    onSelectPlayer={(playerId) => {
                        gameSession.selectResearchPlayer(playerId)
                    }}
                />
                <BoardResearchLayer
                    selectedPlayerId={
                        gameSession.researchSelectionEnabled ? gameSession.selectedResearchPlayerId : null
                    }
                    currentPlayerId={gameSession.currentResearchPlayerId}
                />
            {/if}
        </svg>
        {#if SHOW_DEBUG_GEOMETRY}
            <BoardDebugOverlay width={BOARD_WIDTH} height={BOARD_HEIGHT} bind:active={debugOverlayActive} />
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
