<script lang="ts">
    import { onMount } from 'svelte'
    import { FlightKind, registerFlight } from '$lib/animators/flights.svelte.js'
    import { DomFlightStage } from '$lib/animators/flightStage.js'
    import { HandAnimator } from '$lib/animators/handAnimator.js'
    import { ShareCardAnimator } from '$lib/animators/shareCardAnimator.js'
    import { TrackPieceAnimator } from '$lib/animators/trackPieceAnimator.js'
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import HandPiece from './HandPiece.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    let layer: HTMLElement

    // The animators listen while this layer is the one on screen; it unmounting interrupts them.
    onMount(() => {
        const root = layer.closest('dialog') ?? layer.ownerDocument
        const hosting = {
            host: gameSession,
            flights,
            stage: new DomFlightStage(root, flights),
            viewerId: () => gameSession.myPlayer?.id
        }
        const animators = [
            new TrackPieceAnimator(hosting),
            new ShareCardAnimator(hosting),
            new HandAnimator(hosting)
        ]
        for (const animator of animators) animator.register()
        return () => {
            for (const animator of animators) animator.unregister()
        }
    })
</script>

<!-- Contract, "Flight layer": the moving copies crossing the scaling wrapper; no game state. -->
<div class="flight-layer" bind:this={layer} aria-hidden="true" data-flight-layer>
    {#each flights.flights as flight (flight.id)}
        <div
            class="flight"
            style:left="{flight.rect.left}px"
            style:top="{flight.rect.top}px"
            style:width="{flight.rect.width}px"
            style:height="{flight.rect.height}px"
            data-flight={flight.item.kind}
            use:registerFlight={{ flights, id: flight.id }}
        >
            {#if flight.item.kind === FlightKind.Piece}
                <HandPiece piece={flight.item.piece} size={flight.rect.width} />
            {:else}
                <img src={shareFaceImage(flight.item.railroadId).src} alt="" />
            {/if}
        </div>
    {/each}
</div>

<style>
    .flight-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 45;
    }

    .flight {
        position: absolute;
        opacity: 0;
        transform-origin: 0 0;
        will-change: transform;
    }

    .flight :global(svg),
    .flight img {
        display: block;
        width: 100%;
        height: 100%;
    }

    .flight img {
        border-radius: 3px;
        box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
    }
</style>
