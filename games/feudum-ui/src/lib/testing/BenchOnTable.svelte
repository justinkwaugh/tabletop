<script lang="ts">
    import type { ComponentProps } from 'svelte'
    import Bench from '$lib/components/bench/Bench.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import { TableLayers } from '$lib/model/tableLayers.svelte.js'

    /** The bench on a table, for a spec's markup: its beads enlarge through the table's layers. */
    let props: ComponentProps<typeof Bench> = $props()

    setTableLayers(new TableLayers())
</script>

<Bench {...props} />
