<script lang="ts">
    import type { CityId } from '@tabletop/ride-the-rails'
    import { passengerKey } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { passengerSpot } from '$lib/utils/passengerLayout.js'
    import PassengerFigure from './PassengerFigure.svelte'

    let { startCityId }: { startCityId: CityId | undefined } = $props()

    const gameSession = getGameSession()

    // A passenger on its journey, or one an Undo is taking away, is drawn by the flight layer and
    // gone from here, as a taken one is.
    const cities = $derived(
        cityPieces(gameSession.gameState).map((city) => ({
            cityId: city.cityId,
            waiting:
                city.passenger && !gameSession.flights.hiddenKeys.has(passengerKey(city.cityId))
        }))
    )
</script>

<!-- R-3.3.1: a passenger waits at each city in the state's passengers; a taken one never comes
     back on the USA map (R-3.3.6), so it leaves nothing. -->
<g class="passengers" aria-hidden="true">
    {#each cities as city (city.cityId)}
        <!-- A picked journey start's passenger is drawn grown and centred by the staged route. -->
        {#if city.waiting && city.cityId !== startCityId}
            {@const spot = passengerSpot(city.cityId, false)}
            <g transform="translate({spot.x} {spot.y}) scale({spot.scale})">
                <PassengerFigure />
            </g>
        {/if}
    {/each}
</g>
