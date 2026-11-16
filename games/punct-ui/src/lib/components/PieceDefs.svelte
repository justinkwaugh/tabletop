<script lang="ts">
    import { SHADE_LEVELS, type Tone } from '$lib/board/pieceShape.js'
    import { sideStops } from '$lib/board/pieceColours.js'
    import { DISH_MATERIALS, DISH_RINGS, dishStops } from '$lib/board/dishShape.js'

    // The side's shading, one gradient per tone and shade level, shared by every piece in one SVG.
    let { prefix }: { prefix: string } = $props()

    const TONES: Tone[] = ['light', 'dark']
    const shades = Array.from({ length: SHADE_LEVELS }, (_, shade) => shade)
    const rings = Array.from({ length: DISH_RINGS }, (_, ring) => ring)
</script>

{#each TONES as tone (tone)}
    {#each shades as shade (shade)}
        <linearGradient id="{prefix}-{tone}-{shade}" x1="0" x2="1" y1="0" y2="0">
            {#each sideStops(tone, shade) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.colour}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}
<!-- Each dish ring shaded far to near, top to bottom of its own ellipse. -->
{#each DISH_MATERIALS as material (material)}
    {#each rings as ring (ring)}
        <linearGradient id="{prefix}-dish-{material}-{ring}" x1="0" x2="0" y1="0" y2="1">
            {#each dishStops(material, ring) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.colour}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}
<!-- A soft sheen on the PÜNCT's smooth insert. -->
<radialGradient id="{prefix}-sheen">
    <stop offset="0" stop-color="white" stop-opacity="0.3"></stop>
    <stop offset="1" stop-color="white" stop-opacity="0"></stop>
</radialGradient>
