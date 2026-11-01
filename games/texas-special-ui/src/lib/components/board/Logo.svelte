<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LOGO_SIZE, boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
    const origin = $derived(layout.spec.logo)

    // Two rails over ties, about as wide as the title, as on a timetable heading.
    const TITLE_CHAR_WIDTH = 15
    const TRACK_Y = 8
    const TIE_STEP = 6
    const trackWidth = $derived(
        Math.min(LOGO_SIZE.width - 40, layout.spec.title.length * TITLE_CHAR_WIDTH)
    )
    const ties = $derived(
        Array.from(
            { length: Math.floor(trackWidth / TIE_STEP) + 1 },
            (_, index) => -trackWidth / 2 + index * TIE_STEP
        )
    )
</script>

<g transform="translate({origin.x} {origin.y})" role="img" aria-label={layout.spec.title}>
    <text y="0" class="title">{layout.spec.title}</text>
    {#each ties as x (x)}
        <rect {x} y={TRACK_Y - 1} width="2" height="8" class="tie" />
    {/each}
    <line x1={-trackWidth / 2} x2={trackWidth / 2} y1={TRACK_Y + 1} y2={TRACK_Y + 1} class="rail" />
    <line x1={-trackWidth / 2} x2={trackWidth / 2} y1={TRACK_Y + 5} y2={TRACK_Y + 5} class="rail" />
    <text y="28" class="credit">{layout.spec.credit}</text>
</g>

<style>
    .title {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 28px;
        font-weight: 500;
        letter-spacing: 0.06em;
        fill: #18222f;
        text-anchor: middle;
        paint-order: stroke;
        stroke: #f6eed7;
        stroke-width: 4px;
    }

    .tie {
        fill: #425e80;
    }

    .rail {
        stroke: #18222f;
        stroke-width: 1.6;
    }

    .credit {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 9.5px;
        font-style: italic;
        fill: #384f6c;
        text-anchor: middle;
    }
</style>
