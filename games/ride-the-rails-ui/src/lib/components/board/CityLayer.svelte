<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { fiveRing } from '$lib/utils/cityMarks.js'
    import { startCues } from '$lib/utils/startCues.js'
    import StartBand from './StartBand.svelte'

    const gameSession = getGameSession()

    // R-4.2.3: where a newly available railroad could start now but its colour is not printed
    // (Yellow in a westernmost city), the colour joins the city's band until it no longer may.
    const cues = $derived(BOARD_LOOK.startCue === 'band' ? startCues(gameSession.gameState) : [])

    const cities = $derived(
        cityPieces(gameSession.gameState).map((city) => ({
            ...city,
            center: hexCenter(city.hexId),
            fiveRing: fiveRing(city.bonus),
            bandColours: [
                ...city.startColours,
                ...cues
                    .filter(
                        (cue) =>
                            cue.hexId === city.hexId && !city.startColours.includes(cue.railroadId)
                    )
                    .map((cue) => cue.railroadId)
            ]
        }))
    )
</script>

<!-- R-4.2, R-4.3: start bands, and a green ring just outside each $5 city whose bonus is still to
     be had (R-4.3.2); the bonus pills are drawn above the start cues (BonusLayer). The look of
     each mark is the one BOARD_LOOK picks (startMark); other styles are drawn beside them. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        <g transform="translate({city.center.x} {city.center.y})" data-city-marks={city.cityId}>
            {#if city.fiveRing}
                <polygon
                    points={city.fiveRing.points}
                    fill="none"
                    stroke="var(--rtr-five)"
                    stroke-width={city.fiveRing.width}
                    stroke-linejoin="round"
                    data-five-ring
                ></polygon>
            {/if}
            {#if BOARD_LOOK.startMark === 'band' && city.bandColours.length > 0}
                <StartBand startColours={city.bandColours} />
            {/if}
        </g>
    {/each}
</g>
