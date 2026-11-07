<script lang="ts">
    import SeatPanel from '$lib/components/seat/SeatPanel.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatPanelView } from '$lib/model/seatPanel.js'
    import { TableLayers } from '$lib/model/tableLayers.svelte.js'

    /** A panel on a table, for a spec's markup: alone its pieces take no press. */
    let {
        view,
        paint,
        reading = false
    }: { view: SeatPanelView; paint: SeatPaint; reading?: boolean } = $props()

    setTableLayers(new TableLayers())
</script>

<SeatPanel {view} {paint} {reading} />
