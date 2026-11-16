<script lang="ts">
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { Point } from '@tabletop/common'
    let {
        at,
        size,
        cancel,
        accept
    }: {
        at: Point
        size: number
        cancel: { label: string; onclick: () => void }
        accept?: { label: string; title?: string; onclick: () => void }
    } = $props()
</script>

<div
    class="controls"
    transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
    style:left={`${at.x}px`}
    style:top={`${at.y}px`}
    style:font-size={`${size}px`}
>
    <button class="cancel" aria-label={cancel.label} title={cancel.label} onclick={cancel.onclick}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"></path></svg>
    </button>
    {#if accept}<button
            class="accept"
            aria-label={accept.label}
            title={accept.title ?? accept.label}
            onclick={accept.onclick}
        >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"></path></svg>
        </button>{/if}
</div>

<style>
    .controls {
        position: absolute;
        display: flex;
        gap: 0.18em;
        transform: translate(-50%, -50%);
        pointer-events: auto;
    }
    button {
        display: grid;
        place-items: center;
        width: 1em;
        height: 1em;
        padding: 0;
        font: inherit;
        border-radius: 50%;
        border: 1px solid #fff9;
        box-shadow: 0 2px 5px #0005;
        color: white;
        cursor: pointer;
    }
    .cancel {
        background: #b34242;
    }
    .accept {
        background: #347752;
    }
    button:hover {
        filter: brightness(1.15);
    }
    button:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 3px;
    }
    svg {
        width: 0.69em;
        height: 0.69em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
</style>
