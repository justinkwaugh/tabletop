<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { TRACK_PIECE_RADIUS } from '$lib/utils/boardLayout.js'
    import { railroadColour, railroadInk, railroadRim } from '$lib/utils/railroadPalette.js'

    let { railroadId, radius = TRACK_PIECE_RADIUS }: { railroadId: RailroadId; radius?: number } =
        $props()

    const rail = $derived(radius * 0.45)
    const gauge = $derived(radius * 0.15)
    const tie = $derived(radius * 0.3)
    const ties = $derived([-radius * 0.28, 0, radius * 0.28])
    const ink = $derived(railroadInk(railroadId))
</script>

<!-- R-X.4, O-5: the round token alone, in the print look of the map: the railroad's colour, a
     darker rim, a thin inner ring and a small rail-and-tie mark. Nothing joins it to its neighbours. -->
<circle cy={radius * 0.12} r={radius} fill="var(--pp-halo)" opacity="0.4"></circle>
<circle
    r={radius}
    data-piece-disc
    fill={railroadColour(railroadId)}
    stroke={railroadRim(railroadId)}
    stroke-width={radius * 0.16}
></circle>
<circle r={radius * 0.68} fill="none" stroke={ink} stroke-opacity="0.6" stroke-width={radius * 0.05}
></circle>
<path
    d={ties.map((x) => `M${x} ${-tie} V${tie}`).join(' ')}
    stroke={ink}
    stroke-opacity="0.7"
    stroke-width={radius * 0.07}
></path>
<path
    d="M{-rail} {-gauge} H{rail} M{-rail} {gauge} H{rail}"
    stroke={ink}
    stroke-width={radius * 0.1}
    stroke-linecap="round"
></path>
