<script lang="ts">
    import type { CityId, HexId } from '@tabletop/ride-the-rails'
    import { passengerKey } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { passengerSpot } from '$lib/utils/passengerLayout.js'
    import PassengerFigure from './PassengerFigure.svelte'

    let {
        startCityId,
        scrimHoles,
        cities,
        shaded = false
    }: {
        startCityId: CityId | undefined
        /** The lit hexes, holes in the pick's scrim. */
        scrimHoles: ReadonlySet<HexId>
        /**
         * Which cities' passengers this pass draws. Both passes stand over the scrim and the
         * impassable sides' red lines, so a passenger is drawn over a line its head reaches. A
         * lit city's passenger is never dimmed: its head stands in the hex above, outside its own
         * hex's hole.
         */
        cities: 'unlit' | 'lit'
        /**
         * Whether a pick's scrim is laid: the unlit pass then dims each of its passengers itself,
         * with the scrim's fill over the figure, since it is drawn above the scrim.
         */
        shaded?: boolean
    } = $props()

    const gameSession = getGameSession()

    // A passenger on its journey, or one an Undo is taking away, is drawn by the flight layer and
    // gone from here, as a taken one is.
    const waiting = $derived(
        cityPieces(gameSession.gameState)
            .filter((city) => scrimHoles.has(city.hexId) === (cities === 'lit'))
            .map((city) => ({
                cityId: city.cityId,
                waiting:
                    city.passenger && !gameSession.flights.hiddenKeys.has(passengerKey(city.cityId))
            }))
    )
</script>

<!-- R-3.3.1: a passenger waits at each city in the state's passengers; a taken one never comes
     back on the USA map (R-3.3.6), so it leaves nothing. -->
<g class="passengers" aria-hidden="true" data-passengers={cities}>
    {#each waiting as city (city.cityId)}
        <!-- A picked journey start's passenger is drawn grown and centred by the staged route. -->
        {#if city.waiting && city.cityId !== startCityId}
            {@const spot = passengerSpot(city.cityId, false)}
            <g transform="translate({spot.x} {spot.y}) scale({spot.scale})">
                <PassengerFigure {shaded} />
            </g>
        {/if}
    {/each}
</g>
