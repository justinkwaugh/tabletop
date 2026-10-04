<script lang="ts">
    import { WorldSide } from '@tabletop/stellar-horizons-2'
    import { WORLD_ART } from '$lib/art/manifest.js'

    let {
        tileId,
        side = WorldSide.I,
        size = 64
    }: { tileId: string; side?: WorldSide; size?: number } = $props()
    const art = $derived(WORLD_ART[tileId])
</script>

<img
    src={side === WorldSide.II && art.II ? art.II : art.I}
    alt="World {tileId}"
    width={size}
    height={size}
/>
