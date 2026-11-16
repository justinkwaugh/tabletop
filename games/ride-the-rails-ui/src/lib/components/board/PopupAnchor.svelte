<script module lang="ts">
    export const CHOICE_ANCHOR_ID = 'rtr-railroad-choice-anchor'
    export const DETAIL_ANCHOR_ID = 'rtr-hex-detail-anchor'
    export const RIDE_ANCHOR_ID = 'rtr-ride-anchor'
</script>

<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { HEX_SIZE, HEX_WIDTH, hexCenter } from '$lib/utils/boardGeometry.js'

    let { id, hexId }: { id: string; hexId: HexId | undefined } = $props()

    const center = $derived(hexId ? hexCenter(hexId) : undefined)
</script>

<!-- The Floater's reference point: the hex's box, outside the hit layer's presses. -->
<g {id} aria-hidden="true" pointer-events="none">
    {#if center}
        <rect
            x={center.x - HEX_WIDTH / 2}
            y={center.y - HEX_SIZE}
            width={HEX_WIDTH}
            height={HEX_SIZE * 2}
            fill="transparent"
        ></rect>
    {/if}
</g>
