<script lang="ts">
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { Point } from '@tabletop/common'
    import type { MapLocationFollowUp } from '../session/eighteenXXSession.svelte.js'
    import { followHex } from './followHex.js'

    let { followUp, viewport }: { followUp: MapLocationFollowUp; viewport: HTMLDivElement } =
        $props()
    let center: Point = $state({ x: 0, y: 0 })
    let width = $state(0)
    let height = $state(0)
    let hexHeight = $state(0)
    let panelWidth = $state(0)
    let panelHeight = $state(0)
    const trackHex = followHex(
        () => viewport,
        (placement) => {
            center = placement.center
            width = placement.width
            height = placement.height
            hexHeight = placement.hexHeight
        }
    )
    // Beside the hex, on the right unless the panel only fits on the left; kept inside the map.
    const position = $derived.by(() => {
        const gap = hexHeight * 0.55
        const right = center.x + gap
        const x =
            right + panelWidth <= width || center.x - gap - panelWidth < 0
                ? right
                : center.x - gap - panelWidth
        return {
            x: Math.max(4, Math.min(width - panelWidth - 4, x)),
            y: Math.max(4, Math.min(height - panelHeight - 4, center.y - panelHeight / 2))
        }
    })
</script>

<span class="hex-anchor" hidden use:trackHex={followUp.locationId}></span>
{#if width}
    <div
        class="follow-up"
        role="group"
        aria-label={followUp.label}
        bind:clientWidth={panelWidth}
        bind:clientHeight={panelHeight}
        style:left={`${position.x}px`}
        style:top={`${position.y}px`}
        transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
    >
        <div class="heading">
            <p>{followUp.label}</p>
            <button
                class="cancel"
                aria-label="Cancel"
                title="Cancel"
                onclick={() => followUp.cancel()}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"
                    ><path d="m7 7 10 10M17 7 7 17"></path></svg
                >
            </button>
        </div>
        {#each followUp.options as option (option.id)}
            <button class="option" onclick={() => followUp.choose(option.id)}>{option.label}</button
            >
        {/each}
    </div>
{/if}

<style>
    .follow-up {
        position: absolute;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 9em;
        max-width: 16em;
        padding: 6px;
        border-radius: 6px;
        background: var(--rail-solid, #302d29);
        color: #fffaf2;
        box-shadow: 0 2px 6px #0005;
        font-size: 13px;
    }
    .heading {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    p {
        flex: 1;
        margin: 0 2px;
        font-weight: 600;
    }
    button {
        cursor: pointer;
        font: inherit;
    }
    .option {
        padding: 5px 10px;
        border: 1px solid #fff6;
        border-radius: 4px;
        background: #fff1;
        color: inherit;
        text-align: left;
    }
    .option:hover {
        background: #fff3;
    }
    .cancel {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 1px solid #fff9;
        border-radius: 50%;
        background: #b34242;
        color: white;
    }
    button:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 2px;
    }
    svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
    }
</style>
