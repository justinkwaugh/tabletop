<script lang="ts">
    import type { Hold, Star } from '@tabletop/napoleons-triumph'
    import { STAR_INKS, STAR_POINTS, starPaint } from '$lib/utils/objectiveStars.js'

    let { star, hold, strokeWidth }: { star: Star; hold: Hold | undefined; strokeWidth: number } =
        $props()

    const paint = $derived(starPaint(star, hold))
</script>

<polygon
    points={STAR_POINTS}
    fill={paint.fill}
    fill-opacity={paint.fillOpacity}
    stroke={STAR_INKS[star]}
    stroke-width={strokeWidth}
    stroke-linejoin="miter"
></polygon>
