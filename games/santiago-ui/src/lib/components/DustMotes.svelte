<script lang="ts">
    import { W, H } from '$lib/utils/boardGeometry.js'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const MAX_MOTES = 24

    const session = getGameSession()
    const count = $derived(Math.round(session.landMood.drought * MAX_MOTES))

    // Fixed per-mote variety, so the motes never move in step and the pattern stays stable as
    // their number grows or shrinks.
    function moteStyle(index: number): string {
        const unit = (salt: number) => (((index + 1) * 2654435761 * salt) % 1000) / 1000
        const drift = 14 + unit(3) * 12
        return [
            `left: ${unit(5) * 100}%`,
            `top: ${10 + unit(7) * 85}%`,
            `--size: ${1.5 + unit(11) * 2}px`,
            `--dx: ${60 + unit(13) * 140}px`,
            `--dy: ${-(10 + unit(17) * 40)}px`,
            `animation-duration: ${drift}s`,
            `animation-delay: ${-unit(19) * drift}s`
        ].join('; ')
    }
</script>

<div class="dust" aria-hidden="true" style="left: 10px; top: 10px; width: {W}px; height: {H}px">
    {#each { length: count } as _, index (index)}
        <div class="drift" style={moteStyle(index)}>
            <div class="mote" style="animation-duration: {3 + (index % 5) * 0.7}s"></div>
        </div>
    {/each}
</div>

<style>
    .dust {
        position: absolute;
        pointer-events: none;
        overflow: hidden;
        border-radius: 14px;
    }
    .drift {
        position: absolute;
        animation-name: mote-drift;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }
    .mote {
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        background: rgba(255, 246, 225, 0.9);
        box-shadow: 0 0 4px 1px rgba(255, 240, 205, 0.55);
        animation-name: mote-twinkle;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }
    @keyframes mote-drift {
        0% {
            transform: translate(0, 0);
            opacity: 0;
        }
        15%,
        80% {
            opacity: 1;
        }
        100% {
            transform: translate(var(--dx), var(--dy));
            opacity: 0;
        }
    }
    @keyframes mote-twinkle {
        from {
            opacity: 0.35;
            transform: translateY(0);
        }
        to {
            opacity: 1;
            transform: translateY(-4px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .dust {
            display: none;
        }
    }
</style>
