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

    /** Contract, Render ownership: what crosses the scaling wrapper flies here, outside it. */
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
    {:else if face.kind === 'score'}
        {@const gained = `${face.change > 0 ? '+' : ''}${face.change}`}
        <span class="score-copy">
            <SeatToken
                kind="disc"
                paint={paintOf(face.playerId)}
                size={DesignSize}
                label="{paintOf(face.playerId).owner} score {gained} vp"
            />
            <span class="score-chip" class:lost={face.change < 0}>{gained}</span>
        </span>
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
            {#if flight.flash}
                <span class="flash-ring" data-flight-flash {@attach animator.flashRing(flight.id)}
                ></span>
            {/if}
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

    /* R-3.6 A lost piece's flash: a rose ring round the copy, its opacity alone tweened. */
    .flash-ring {
        position: absolute;
        left: 0;
        top: 0;
        width: 60px;
        height: 60px;
        transform: translate(-50%, -50%);
        border: 4px solid var(--feudum-danger);
        border-radius: 50%;
        opacity: 0;
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

    /* R-6 A score's disc carries what it gained, or in rose what it lost. */
    .score-copy {
        position: relative;
        display: inline-block;
    }

    .score-chip {
        position: absolute;
        top: -10px;
        right: -18px;
        padding: 2px 5px;
        border: 1px solid var(--feudum-frame);
        border-radius: 999px;
        background: var(--feudum-halo);
        color: var(--feudum-text);
        font: 600 16px/1 var(--feudum-font-text);
    }

    .score-chip.lost {
        border-color: var(--feudum-danger);
        color: var(--feudum-danger);
    }
</style>
