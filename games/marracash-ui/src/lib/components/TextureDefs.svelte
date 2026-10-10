<script lang="ts">
    import { PackedEarthPatternId, StreetDustPatternId } from '$lib/utils/ground.js'
    import { WeavePatternId } from '$lib/utils/stalls.js'
    import sand from '$lib/images/sand.webp'
    import dust from '$lib/images/dust.webp'
    import weave from '$lib/images/stall-weave.webp'

    // Pre-rendered noise (scripts/generate-textures.mjs): generated in the browser instead, these
    // textures made every full redraw of the board 40 to 55% slower in WebKit.
    const tiles = [
        { id: PackedEarthPatternId, href: sand, size: 400 },
        // Sized so it never lines up with the earth tile
        { id: StreetDustPatternId, href: dust, size: 560 },
        // Fine grain with no large features, so a small tile repeats unseen
        { id: WeavePatternId, href: weave, size: 128 }
    ]
</script>

{#each tiles as tile (tile.id)}
    <pattern id={tile.id} width={tile.size} height={tile.size} patternUnits="userSpaceOnUse">
        <image href={tile.href} width={tile.size} height={tile.size} preserveAspectRatio="none"
        ></image>
    </pattern>
{/each}
