<script module lang="ts">
    export const CHOICE_ANCHOR_ID = 'rtr-railroad-choice-anchor'
    export const DETAIL_ANCHOR_ID = 'rtr-hex-detail-anchor'
    export const RIDE_ANCHOR_ID = 'rtr-ride-anchor'
</script>

<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { hexBox } from '$lib/utils/boardGeometry.js'

    let { id, hexId }: { id: string; hexId: HexId | undefined } = $props()

    const box = $derived(hexId ? hexBox(hexId) : undefined)
</script>

<!-- The Floater's reference point: the hex's box, outside the hit layer's presses. -->
<g {id} aria-hidden="true" pointer-events="none">
    {#if box}
        <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent"></rect>
    {/if}
</g>
