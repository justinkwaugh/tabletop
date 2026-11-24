<script lang="ts">
    import PanelBlocks from '$lib/components/panel/PanelBlocks.svelte'
    import type { RowPointer } from '$lib/components/table/PanelRow.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import type { ActionPanelView } from '$lib/model/actionPanel.js'
    import { TableLayers } from '$lib/model/tableLayers.svelte.js'

    let { view, pointer }: { view: ActionPanelView; pointer: RowPointer } = $props()

    setTableLayers(new TableLayers())
</script>

<PanelBlocks {view} {pointer} />
