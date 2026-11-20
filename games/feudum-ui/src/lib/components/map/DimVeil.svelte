<script lang="ts">
    import { VeilOpacity } from '$lib/model/boardChrome.js'

    /**
     * Phone rendering, effects stay piece-sized: a raster too large to dim on its own (the map, a
     * guild area's print) dims under this, one plain shape in the board's ground colour, drawn over
     * it and under whatever stays lit. It takes no presses.
     */
    let { x, y, width, height }: { x: number; y: number; width: number; height: number } = $props()
</script>

<rect
    {x}
    {y}
    {width}
    {height}
    fill="var(--feudum-surface)"
    fill-opacity={VeilOpacity}
    pointer-events="none"
    data-dim-veil
></rect>
