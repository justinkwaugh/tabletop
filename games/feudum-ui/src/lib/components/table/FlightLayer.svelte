<script lang="ts">
    import type { Flight, FlightFace } from '$lib/animators/flightPlan.js'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { FlightAnimator } from '$lib/animators/flightAnimator.svelte.js'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * Contract, Flight layer: what crosses the scaling wrapper is drawn here, above the table and outside
     * the wrapper, in the full-screen dialog while it is open. Each copy is written once; its animator
     * owns its style from then until the state shows. Nothing here is ever pressed or read.
     */
    let {
        animator,
        paintOf
    }: {
        animator: FlightAnimator
        paintOf: (playerId: string) => SeatPaint
    } = $props()

    const DesignSize = 48

    function sidesOf(flight: Flight): readonly FlightFace[] {
        const turned = flight.legs.flatMap(({ turnTo }) => (turnTo ? [turnTo] : [])).at(-1)
        return turned ? [flight.face, turned] : [flight.face]
    }
</script>

{#snippet drawn(face: FlightFace)}
    {#if face.kind === 'good'}
        <GoodToken good={face.good} size={DesignSize} x={0} y={0} />
    {:else if face.kind === 'marker'}
        <SeatToken kind="marker" paint={paintOf(face.playerId)} size={DesignSize} />
    {:else if face.kind === 'pawn'}
        <PawnPiece paint={paintOf(face.playerId)} character={face.character} size={DesignSize} />
    {:else if face.kind === 'shilling'}
        <ShillingToken value={1} size={DesignSize} />
    {:else if face.kind === 'tile'}
        <TileFace
            faceShown={face.faceShown}
            epoch={face.epoch}
            region={face.region}
            landscape={face.landscape}
            size={DesignSize}
        />
    {:else if face.kind === 'writ'}
        {#if face.faceShown}
            <WritFace faceShown={true} writId={face.writId} width={DesignSize} />
        {:else}
            <WritFace faceShown={false} width={DesignSize} />
        {/if}
    {:else if face.kind === 'seal'}
        <SealFace faceShown={sealFaceShown(false)} size={DesignSize} />
    {:else}
        <SealFace faceShown={sealFaceShown(true)} beadValue={face.value} size={DesignSize} />
    {/if}
{/snippet}

<div class="flight-layer" data-flight-layer aria-hidden="true" {@attach animator.attach}>
    {#each animator.flights as flight (flight.id)}
        <div
            class="flight-copy"
            data-flight={flight.id}
            data-flight-row={flight.row}
            {@attach animator.copy(flight.id)}
        >
            {#each sidesOf(flight) as face, side (side)}
                <div
                    class="flight-side"
                    data-flight-side={side === 0 ? 'first' : 'then'}
                    data-flight-face={face.kind}
                    hidden={side !== 0}
                >
                    {@render drawn(face)}
                </div>
            {/each}
        </div>
    {/each}
</div>

<style>
    .flight-layer {
        position: fixed;
        inset: 0;
        z-index: 70;
        overflow: hidden;
        pointer-events: none;
    }

    .flight-copy {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        visibility: hidden;
        transform-origin: 0 0;
        will-change: transform;
    }

    .flight-side {
        position: absolute;
        transform: translate(-50%, -50%);
        width: max-content;
        line-height: 0;
    }

    .flight-side[hidden] {
        display: none;
    }
</style>
