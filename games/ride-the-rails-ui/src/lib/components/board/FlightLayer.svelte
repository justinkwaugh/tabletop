<script lang="ts">
    import { attachFlights } from '$lib/animators/registerFlights.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import Flyer from './Flyer.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights
</script>

<!-- Contract, Render ownership, layer 10: travelling locomotives, coins and passengers, the
     cities a journey reaches, the round marker, and the claimed line as it is drawn. Phones draw
     the flyers above the whole table instead (PhoneFlightLayer), as their flights end beyond the
     board. -->
<g class="flights" aria-hidden="true" pointer-events="none" {@attach attachFlights(gameSession)}>
    {#if !isPhoneWidth()}
        {#each flights.flyers as flyer (flyer.key)}
            <Flyer {flyer} />
        {/each}
    {/if}
</g>
