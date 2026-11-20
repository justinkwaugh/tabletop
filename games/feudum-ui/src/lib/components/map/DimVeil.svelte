<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { VeilOpacity } from '$lib/model/boardChrome.js'

    /** Phone rendering, effects stay piece-sized: a raster too large to dim dims under this. */
    let { x, y, width, height }: BoundingBox = $props()
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
