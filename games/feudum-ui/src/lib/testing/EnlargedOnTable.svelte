<script lang="ts">
    import EnlargedLayer from '$lib/components/table/EnlargedLayer.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
    import { TableLayers } from '$lib/model/tableLayers.svelte.js'

    /** The enlarged view as a table holds it, for a spec's markup. */
    let { face, width }: { face: EnlargedFace; width: number } = $props()

    setTableLayers(new TableLayers())
</script>

<EnlargedLayer {face} {width} onClose={() => {}} />
