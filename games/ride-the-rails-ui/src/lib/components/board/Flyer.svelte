<script lang="ts">
    import type { Flyer } from '$lib/animators/flights.svelte.js'
    import { hexPoints } from '$lib/utils/boardGeometry.js'
    import { ROUND_TICKET } from '$lib/utils/marginLayout.js'
    import { polylinePoints } from '$lib/utils/routePath.js'
    import CoinChip from './CoinChip.svelte'
    import Locomotive from './Locomotive.svelte'
    import PassengerFigure from './PassengerFigure.svelte'

    let { flyer }: { flyer: Flyer } = $props()

    // The round marker frames a ticket of the round track.
    const FRAME = { width: ROUND_TICKET.width + 12, height: ROUND_TICKET.height + 12 }
</script>

<!-- One flyer's payload, in board units and centred on its wrapper's origin. -->
{#if flyer.kind === 'locomotive'}
    <Locomotive railroadId={flyer.railroadId} x={0} y={0} width={flyer.width} />
{:else if flyer.kind === 'coin'}
    <CoinChip amount={flyer.amount} gold={flyer.gold} />
{:else if flyer.kind === 'passenger'}
    <PassengerFigure />
{:else if flyer.kind === 'pulse'}
    <circle r={flyer.radius} fill="none" stroke="var(--rtr-ink)" stroke-width="3"></circle>
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
