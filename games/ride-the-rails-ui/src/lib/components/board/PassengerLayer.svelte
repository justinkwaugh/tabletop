<script lang="ts">
    import type { CityId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'

    let { startCityId }: { startCityId: CityId | undefined } = $props()

    const gameSession = getGameSession()

    const waiting = $derived(cityPieces(gameSession.gameState).filter((city) => city.passenger))

    // Laid out beside a station disc of this radius and scaled to each city's.
    const DRAWN_RADIUS = 10.6
    // A picked journey start lifts its passenger slightly.
    const LIFT = 6
</script>

<!-- R-3.3.1: a passenger waits at each city in the state's passengers. -->
<g class="passengers" aria-hidden="true">
    {#each waiting as city (city.cityId)}
        <g
            transform="translate({city.station.x} {city.station.y}) scale({city.station.radius /
                DRAWN_RADIUS}) translate(17.2 {-8.8 - (city.cityId === startCityId ? LIFT : 0)})"
        >
            <circle
                cy="-5.4"
                r="3.1"
                fill="var(--rtr-ink)"
                stroke="var(--rtr-station)"
                stroke-width="1.4"
                paint-order="stroke"
            ></circle>
            <path
                d="M-4 5.4 L-3.2 -1.2 Q0 -3 3.2 -1.2 L4 5.4 Z"
                fill="var(--rtr-ink)"
                stroke="var(--rtr-station)"
                stroke-width="1.4"
                paint-order="stroke"
            ></path>
        </g>
    {/each}
</g>
