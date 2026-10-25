<script lang="ts">
    import { STORM_SIZE } from '$lib/board/storm.js'
    import { TABLE_STORM_IMAGE } from '$lib/board/stormImages.js'
    import type { StormPlacement } from '$lib/board/stormPlacement.js'
    import { VIEW } from '$lib/board/geometry.js'

    // Full screen draws it fixed behind the dialog; otherwise it lies on the table.
    let { placement, fixed = false }: { placement: StormPlacement | undefined; fixed?: boolean } =
        $props()

    const size = $derived(placement ? STORM_SIZE * placement.scale : 0)
    // Foreshortened with the board, as the board's own storm is.
    const depth = $derived(size * VIEW.tilt)
    const centre = $derived(placement && (fixed ? placement.screen : placement.table))
</script>

<!-- The table's storm, centred on the board and running on to every edge of the table, as if
     printed on the board's plane. -->
{#if centre}
    <div
        class="storm-backdrop"
        class:fixed
        aria-hidden="true"
        style:background-image="url('{TABLE_STORM_IMAGE}')"
        style:background-size="{size}px {depth}px"
        style:background-position="{centre.x - size / 2}px {centre.y - depth / 2}px"
    ></div>
{/if}

<style>
    .storm-backdrop {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background-repeat: no-repeat;
    }

    .storm-backdrop.fixed {
        position: fixed;
    }
</style>
