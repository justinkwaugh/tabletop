<script lang="ts">
    import type { CityId } from '@tabletop/ride-the-rails'
    import { passengerKey } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { passengerSpot } from '$lib/utils/passengerLayout.js'
    import PassengerFigure from './PassengerFigure.svelte'

    let { startCityId }: { startCityId: CityId | undefined } = $props()

    const gameSession = getGameSession()

    // A passenger on its journey, or one an Undo is taking away, is drawn by the flight layer.
    const waiting = $derived(
        cityPieces(gameSession.gameState).filter(
            (city) =>
                city.passenger && !gameSession.flights.hiddenKeys.has(passengerKey(city.cityId))
        )
    )
</script>

<!-- R-3.3.1: a passenger waits at each city in the state's passengers. -->
<g class="passengers" aria-hidden="true">
    {#each waiting as city (city.cityId)}
        {@const spot = passengerSpot(city.cityId, city.cityId === startCityId)}
        <g transform="translate({spot.x} {spot.y}) scale({spot.scale})">
            <PassengerFigure />
        </g>
    {/each}
</g>
