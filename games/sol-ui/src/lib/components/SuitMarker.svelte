<script lang="ts">
    import { Suit } from '@tabletop/sol'
    import Condensation from '$lib/images/suitMarkers/condensation.png'
    import Expansion from '$lib/images/suitMarkers/expansion.png'
    import Flare from '$lib/images/suitMarkers/flare.png'
    import Oscillation from '$lib/images/suitMarkers/oscillation.png'
    import Refraction from '$lib/images/suitMarkers/refraction.png'
    import Reverberation from '$lib/images/suitMarkers/reverberation.png'
    import Subduction from '$lib/images/suitMarkers/subduction.png'
    import type { HTMLAttributes, SVGAttributes } from 'svelte/elements'

    let {
        suit,
        width = 23.5,
        height = 23.5,
        svg = false,
        ...restProps
    }: { suit: Suit; width?: number; height?: number; svg?: boolean } & HTMLAttributes<Element> &
        SVGAttributes<SVGElement> = $props()

    function imageForSuit(suit: Suit) {
        switch (suit) {
            case Suit.Refraction:
                return Refraction
            case Suit.Condensation:
                return Condensation
            case Suit.Subduction:
                return Subduction
            case Suit.Oscillation:
                return Oscillation
            case Suit.Expansion:
                return Expansion
            case Suit.Reverberation:
                return Reverberation
            case Suit.Flare:
                return Flare
        }
    }

    function backgroundImageForSuit(suit: Suit) {
        return `url(${imageForSuit(suit)})`
    }
</script>

{#if svg}
    <image xlink:href={imageForSuit(suit)} {width} {height}></image>
{:else}
    <div {...restProps}>
        <div
            class="bg-center bg-cover w-full h-full"
            style="background-image: {backgroundImageForSuit(suit)}"
        ></div>
    </div>
{/if}
