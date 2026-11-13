<script lang="ts">
    import { attachFlights } from '$lib/animators/registerFlights.js'
    import { poseTransform } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import Flyer from './Flyer.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights
</script>

<!-- Contract, Render ownership, layer 10: travelling locomotives, coins and passengers, the
     cities a journey reaches, the round marker, and the claimed line as it is drawn. The animators
     tween each flyer's outer wrapper; its payload is centred on it. Phones draw the flyers above the
     whole table instead (PhoneFlightLayer), as their flights end beyond the board. -->
<g class="flights" aria-hidden="true" pointer-events="none" {@attach attachFlights(gameSession)}>
    {#if !isPhoneWidth()}
        {#each flights.flyers as flyer (flyer.key)}
            <g
                use:flights.register={flyer.key}
                transform={poseTransform(flyer.pose)}
                opacity={flyer.pose.opacity}
            >
                <Flyer {flyer} />
            </g>
        {/each}
    {/if}
</g>
