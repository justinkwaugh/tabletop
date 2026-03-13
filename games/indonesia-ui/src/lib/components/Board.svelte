<script lang="ts">
    import { onMount } from 'svelte'
    import boardImg from '$lib/images/indo_map_sm.jpg'
    import BoardActionAreasLayer from '$lib/components/BoardActionAreasLayer.svelte'
    import BoardCityReferenceCardLayer from '$lib/components/BoardCityReferenceCardLayer.svelte'
    import BoardCitiesLayer from '$lib/components/BoardCitiesLayer.svelte'
    import BoardCultivatedAreasLayer from '$lib/components/BoardCultivatedAreasLayer.svelte'
    import BoardDeedsLayer from '$lib/components/BoardDeedsLayer.svelte'
    import BoardProductionZoneMarkersLayer from '$lib/components/BoardProductionZoneMarkersLayer.svelte'
    import BoardResearchLayer from '$lib/components/BoardResearchLayer.svelte'
    import BoardShippingExpansionSeaHighlightLayer from '$lib/components/BoardShippingExpansionSeaHighlightLayer.svelte'
    import BoardShippingRouteOverlayLayer from '$lib/components/BoardShippingRouteOverlayLayer.svelte'
    import BoardShipsLayer from '$lib/components/BoardShipsLayer.svelte'
    import BoardTurnOrderLayer from '$lib/components/BoardTurnOrderLayer.svelte'
    import BoardDebugOverlay from '$lib/components/BoardDebugOverlay.svelte'
    import type { CityDemandViewMode } from '$lib/model/cityDemandView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { MachineState } from '@tabletop/indonesia'

    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const DEBUG_GEOMETRY_STORAGE_KEY = 'indonesia-debug-geometry'

    const gameSession = getGameSession()
    let debugOverlayActive = $state(false)
    let debugOverlayEnabled = $state(false)
    let hoveredTurnOrderPlayerId = $state<string | null>(null)
    let cityDemandViewMode = $state<CityDemandViewMode>('delivered')
    const phaseLabel = $derived.by(() => {
        const phaseName = gameSession.gameState.phaseManager.currentPhase?.name
        switch (phaseName) {
            case 'NewEra':
                return 'PHASE 1: NEW ERA'
            case 'BidForTurnOrder':
                return 'PHASE 2: BID FOR TURN ORDER'
            case 'Mergers':
                return 'PHASE 3: MERGERS'
            case 'Acquisitions':
                return 'PHASE 4: ACQUISITIONS'
            case 'ResearchAndDevelopment':
                return 'PHASE 5: RESEARCH & DEVELOPMENT'
            case 'Operations':
                return 'PHASE 6: OPERATIONS'
            case 'CityGrowth':
                return 'PHASE 7: CITY GROWTH'
            default:
                return ''
        }
    })
    const cityDemandViewable = $derived.by(() => {
        const state = gameSession.gameState.machineState
        const inOperationsState =
            state === MachineState.Operations ||
            state === MachineState.ShippingOperations ||
            state === MachineState.ProductionOperations
        return inOperationsState && gameSession.gameState.producedGoodsOnBoard().size > 0
    })

    onMount(() => {
        if (typeof window === 'undefined') {
            return
        }

        const initialEnabled =
            window.localStorage.getItem(DEBUG_GEOMETRY_STORAGE_KEY) === '1' ||
            new URLSearchParams(window.location.search).get('debugGeometry') === '1'
        debugOverlayEnabled = initialEnabled

        const debugWindow = window as Window & {
            __setIndonesiaDebugGeometry?: (enabled: boolean) => void
        }
        debugWindow.__setIndonesiaDebugGeometry = (enabled: boolean) => {
            debugOverlayEnabled = enabled
            if (enabled) {
                window.localStorage.setItem(DEBUG_GEOMETRY_STORAGE_KEY, '1')
            } else {
                window.localStorage.removeItem(DEBUG_GEOMETRY_STORAGE_KEY)
                debugOverlayActive = false
            }
        }

        return () => {
            delete debugWindow.__setIndonesiaDebugGeometry
        }
    })
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1280px] w-[2646px]">
        {#if phaseLabel}
            <div class="board-phase-label" aria-hidden="true">{phaseLabel}</div>
        {/if}
        {#if cityDemandViewable}
            <div class="city-demand-toggle" role="group" aria-label="City demand view">
                <button
                    type="button"
                    class:active={cityDemandViewMode === 'delivered'}
                    onclick={() => {
                        cityDemandViewMode = 'delivered'
                    }}
                >
                    Delivered
                </button>
                <button
                    type="button"
                    class:active={cityDemandViewMode === 'remaining'}
                    onclick={() => {
                        cityDemandViewMode = 'remaining'
                    }}
                >
                    Demand
                </button>
            </div>
        {/if}
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
            <g
                class="board-era-watermark"
                aria-hidden="true"
                transform="translate(840 155)"
            >
                <text class="board-era-watermark__label" x="-76" y="0">Era</text>
                <text class="board-era-watermark__value" x="114" y="0">
                    {gameSession.gameState.era}
                </text>
            </g>
            <BoardCityReferenceCardLayer />
            {#if !debugOverlayActive}
                <BoardDeedsLayer />
                <BoardShippingRouteOverlayLayer />
                <BoardCultivatedAreasLayer />
                <BoardShippingExpansionSeaHighlightLayer />
                <BoardShipsLayer />
                <BoardProductionZoneMarkersLayer />
                <BoardActionAreasLayer />
                <BoardCitiesLayer demandViewMode={cityDemandViewMode} />
                <BoardTurnOrderLayer
                    selectedPlayerId={
                        gameSession.researchSelectionEnabled ? gameSession.selectedResearchPlayerId : null
                    }
                    selectable={gameSession.researchSelectionEnabled}
                    onHoverPlayer={(playerId) => {
                        hoveredTurnOrderPlayerId = playerId
                    }}
                    onSelectPlayer={(playerId) => {
                        gameSession.selectResearchPlayer(playerId)
                    }}
                />
                <BoardResearchLayer
                    selectedPlayerId={
                        gameSession.researchSelectionEnabled ? gameSession.selectedResearchPlayerId : null
                    }
                    currentPlayerId={gameSession.currentResearchPlayerId}
                    hoveredPlayerId={hoveredTurnOrderPlayerId}
                />
            {/if}
        </svg>
        {#if debugOverlayEnabled}
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
            radial-gradient(980px 620px at 14% 10%, rgba(255, 255, 255, 0.34), transparent 64%),
            repeating-linear-gradient(
                -30deg,
                rgba(120, 91, 62, 0.018) 0 2px,
                rgba(255, 255, 255, 0.012) 2px 7px
            ),
            #efe6dc;
    }

    .board-era-watermark {
        pointer-events: none;
        color: #6f5135;
        opacity: 0.18;
    }

    .board-era-watermark__label {
        font-family: 'scriptina-pro', cursive;
        font-size: 118px;
        font-weight: 500;
        letter-spacing: 0.08em;
        line-height: 1;
        text-anchor: middle;
        dominant-baseline: middle;
        fill: currentColor;
        paint-order: stroke fill;
        stroke: rgba(255, 250, 241, 0.38);
        stroke-width: 1.2;
    }

    .board-era-watermark__value {
        font-family: 'scriptina-pro', cursive;
        font-size: 101px;
        text-anchor: middle;
        dominant-baseline: middle;
        fill: currentColor;
    }

    .board-surface {
        border-radius: 14px;
        overflow: hidden;
        box-shadow:
            0 0 0 5px rgba(122, 93, 63, 0.28),
            0 10px 22px rgba(92, 66, 41, 0.14);
    }

    .board-image {
        filter: none;
    }

    .board-phase-label {
        position: absolute;
        top: 15px;
        left: 50%;
        z-index: 3;
        transform: translateX(-50%);
        color: rgba(94, 63, 39, 0.92);
        font-family: 'Avenir Next', 'Helvetica Neue', sans-serif;
        font-size: 28px;
        font-weight: 300;
        line-height: 1;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        white-space: nowrap;
        text-shadow: 0 1px 0 rgba(255, 250, 241, 0.45);
        pointer-events: none;
    }

    .city-demand-toggle {
        position: absolute;
        top: 6px;
        left: 16px;
        z-index: 3;
        display: inline-flex;
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        border: 1px solid rgba(122, 93, 63, 0.42);
        background: rgba(244, 235, 225, 0.94);
        box-shadow: 0 2px 10px rgba(85, 62, 40, 0.12);
    }

    .city-demand-toggle button {
        border: 0;
        background: transparent;
        color: #6f5135;
        font-family: 'Avenir Next', 'Helvetica Neue', sans-serif;
        font-size: 13px;
        font-weight: 400;
        line-height: 1;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 9px 13px 8px;
        border-radius: 999px;
        cursor: pointer;
        transition:
            background-color 120ms ease,
            color 120ms ease,
            box-shadow 120ms ease;
    }

    .city-demand-toggle button:hover {
        background: rgba(122, 93, 63, 0.08);
    }

    .city-demand-toggle button.active {
        background: #7a5d3f;
        color: #f7efe6;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
</style>
