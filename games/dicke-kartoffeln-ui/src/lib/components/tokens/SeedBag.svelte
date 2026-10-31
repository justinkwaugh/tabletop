<script lang="ts">
    import type { Variety } from '@tabletop/dicke-kartoffeln'
    import { SEED_IMAGES } from '$lib/utils/tokens.js'
    import Tile from './Tile.svelte'

    let {
        variety,
        size,
        pending = false
    }: { variety: Variety; size: number; pending?: boolean } = $props()
</script>

<Tile {size} {pending}>
    <img src={SEED_IMAGES[variety]} alt="{variety} seed" />
</Tile>
