<script lang="ts">
    import { localeOutlinePoints } from '$lib/map/localeOutline.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const HATCH = 'nt-closed-hatch'
    const LINE_SPACING = 18
    const LINE_WIDTH = 1.6
    // The lines rise to the right on screen however the board is turned, as in the legend.
    const ON_SCREEN_LEAN = 45
</script>

<defs>
    <pattern
        id={HATCH}
        patternUnits="userSpaceOnUse"
        width={LINE_SPACING}
        height={LINE_SPACING}
        patternTransform="rotate({ON_SCREEN_LEAN -
            gameSession.flagView.rotation}) scale({gameSession.flagView.scale})"
    >
        <line
            x1="0"
            y1="0"
            x2="0"
            y2={LINE_SPACING}
            stroke-width={LINE_WIDTH}
            class="nt-closed-line"
        ></line>
    </pattern>
</defs>
<g class="pointer-events-none">
    {#each gameSession.closedReserves as locale (locale)}
        <polygon points={localeOutlinePoints(locale)} class="nt-closed-ground"></polygon>
        <polygon
            points={localeOutlinePoints(locale)}
            fill="url(#{HATCH})"
            data-closed-reserve={locale}
        ></polygon>
    {/each}
</g>

<style>
    .nt-closed-ground {
        fill: var(--nt-closed-fill);
    }

    .nt-closed-line {
        stroke: var(--nt-closed-line);
    }
</style>
