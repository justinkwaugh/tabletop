<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { TRACK_PIECE_RADIUS } from '$lib/utils/boardLayout.js'
    import { railroadColour, railroadInk } from '$lib/utils/railroadPalette.js'

    let { railroadId, radius = TRACK_PIECE_RADIUS }: { railroadId: RailroadId; radius?: number } =
        $props()

    const rail = $derived(radius * 0.42)
    const gauge = $derived(radius * 0.16)
</script>

<!-- R-X.4, O-5: the round token alone; nothing joins it to its neighbours. -->
<circle cy={radius * 0.12} r={radius} fill="var(--pp-halo)" opacity="0.35"></circle>
<circle
    r={radius}
    fill={railroadColour(railroadId)}
    stroke="var(--pp-halo)"
    stroke-width={radius * 0.14}
></circle>
<circle
    r={radius * 0.62}
    fill="none"
    stroke="var(--pp-rr-ink)"
    stroke-opacity="0.35"
    stroke-width={radius * 0.1}
></circle>
<path
    d="M{-rail} {-gauge} H{rail} M{-rail} {gauge} H{rail}"
    stroke={railroadInk(railroadId)}
    stroke-opacity="0.7"
    stroke-width={radius * 0.12}
    stroke-linecap="round"
></path>
