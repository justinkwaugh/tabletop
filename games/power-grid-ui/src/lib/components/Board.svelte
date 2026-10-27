<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { mapArt } from '$lib/maps/boardArt.js'
    import MapView from './board/MapView.svelte'
    import PlantMarket from './panels/PlantMarket.svelte'
    import ResourceMarket from './panels/ResourceMarket.svelte'
    import ControlPanel from './panels/ControlPanel.svelte'
    import { BOARD_GAP, MARKET_COLUMN } from '$lib/utils/boardLayout.js'

    let { stacked = false }: { stacked?: boolean } = $props()

    const session = getGameSession()
    const art = $derived(mapArt(session.gameState.mapId))

    const GAP = BOARD_GAP
    const COLUMN = MARKET_COLUMN
    const panelWidth = $derived(stacked ? art.width : COLUMN)
</script>

<div
    class="board"
    class:stacked
    style:width="{stacked ? art.width : art.width + GAP + COLUMN}px"
    style:gap="{GAP}px"
>
    <div class="map">
        <MapView />
    </div>
    <div class="column" style:gap="{GAP}px">
        <PlantMarket width={panelWidth} />
        <ResourceMarket width={panelWidth} />
        <ControlPanel width={panelWidth} />
    </div>
</div>

<style>
    .board {
        display: flex;
        align-items: flex-start;
    }
    .board.stacked {
        flex-direction: column;
    }
    .map {
        border-radius: 10px;
        overflow: hidden;
        border: 3px solid #1b1f1a;
        box-shadow: 0 3px 8px rgb(0 0 0 / 0.4);
    }
    .column {
        display: flex;
        flex-direction: column;
    }
</style>
