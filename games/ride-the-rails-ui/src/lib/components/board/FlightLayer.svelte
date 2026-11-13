<script lang="ts">
    import { attachFlights } from '$lib/animators/registerFlights.js'
    import { poseTransform } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexPoints } from '$lib/utils/boardGeometry.js'
    import { ROUND_TICKET } from '$lib/utils/marginLayout.js'
    import { polylinePoints } from '$lib/utils/routePath.js'
    import CoinChip from './CoinChip.svelte'
    import Locomotive from './Locomotive.svelte'
    import PassengerFigure from './PassengerFigure.svelte'

    // The round marker frames a ticket of the round track.
    const FRAME = { width: ROUND_TICKET.width + 12, height: ROUND_TICKET.height + 12 }

    const gameSession = getGameSession()
    const flights = gameSession.flights
</script>

<!-- Contract, Render ownership, layer 10: travelling locomotives, coins and passengers, the
     cities a journey reaches, the round marker, and the claimed line as it is drawn. The animators tween each flyer's outer wrapper; its payload is centred on it. -->
<g class="flights" aria-hidden="true" pointer-events="none" {@attach attachFlights(gameSession)}>
    {#each flights.flyers as flyer (flyer.key)}
        <g
            use:flights.register={flyer.key}
            transform={poseTransform(flyer.pose)}
            opacity={flyer.pose.opacity}
        >
            {#if flyer.kind === 'locomotive'}
                <Locomotive railroadId={flyer.railroadId} x={0} y={0} width={flyer.width} />
            {:else if flyer.kind === 'coin'}
                <CoinChip amount={flyer.amount} gold={flyer.gold} />
            {:else if flyer.kind === 'passenger'}
                <PassengerFigure />
            {:else if flyer.kind === 'pulse'}
                <circle r={flyer.radius} fill="none" stroke="var(--rtr-ink)" stroke-width="3"
                ></circle>
            {:else if flyer.kind === 'round'}
                <rect
                    x={-FRAME.width / 2}
                    y={-FRAME.height / 2}
                    width={FRAME.width}
                    height={FRAME.height}
                    rx="9"
                    fill="none"
                    stroke="var(--rtr-ink)"
                    stroke-width="4"
                ></rect>
            {:else if flyer.kind === 'outline'}
                <polygon
                    points={hexPoints(flyer.hexId)}
                    fill="none"
                    stroke="var(--rtr-gold)"
                    stroke-width="4"
                    stroke-linejoin="round"
                ></polygon>
            {:else}
                <polyline
                    points={polylinePoints(flyer.hexIds)}
                    fill="none"
                    stroke="var(--rtr-gold)"
                    stroke-width="3"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                ></polyline>
            {/if}
        </g>
    {/each}
</g>
