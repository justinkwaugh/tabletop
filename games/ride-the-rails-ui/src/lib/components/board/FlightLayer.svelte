<script lang="ts">
    import { onTheMap } from '$lib/animators/flightPlaces.js'
    import { attachFlights } from '$lib/animators/registerFlights.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import Flyer from './Flyer.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const onMap = $derived(isPhoneWidth() ? [] : flights.flyers.filter(onTheMap))
</script>

<!-- Contract, Render ownership, layer 11: the flyers that stay on the map, a journey's passenger,
     the cities it reaches, and the claimed line as it is drawn. Locomotives and coins fly to and
     from the table beside the board, so they are drawn above it (TableFlightLayer), as are a
     phone's map flyers. -->
<g class="flights" aria-hidden="true" pointer-events="none" {@attach attachFlights(gameSession)}>
    {#each onMap as flyer (flyer.key)}
        <Flyer {flyer} />
    {/each}
</g>
