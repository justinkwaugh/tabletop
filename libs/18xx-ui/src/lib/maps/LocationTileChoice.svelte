<script lang="ts">
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { Point } from '@tabletop/common'
    import type { HexOrientation } from '@tabletop/common'
    import type { MapLocationFollowUp } from '../session/eighteenXXSession.svelte.js'
    import Tile from '../tiles/Tile.svelte'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { followHex } from './followHex.js'
    import HexPickerControls from './HexPickerControls.svelte'
    import { tileChoiceArc } from './tileChoiceArc.js'

    let {
        followUp,
        viewport,
        orientation,
        appearance
    }: {
        followUp: MapLocationFollowUp
        viewport: HTMLDivElement
        orientation: HexOrientation
        appearance?: TileAppearance
    } = $props()
    let center: Point = $state({ x: 0, y: 0 })
    let width = $state(0)
    let height = $state(0)
    let tileSize = $state(80)
    let hexHeight = $state(100)
    const trackHex = followHex(
        () => viewport,
        (placement) => {
            center = placement.center
            width = placement.width
            height = placement.height
            hexHeight = placement.hexHeight
            if (placement.mapScale !== undefined) tileSize = 106 * placement.mapScale
        }
    )
    const arc = $derived(
        tileChoiceArc(center, width, height, followUp.options.length, tileSize, 1.4)
    )
    const buttonSize = $derived(tileSize * 0.42)
    const controls = $derived({
        x: Math.max(buttonSize * 1.2, Math.min(width - buttonSize * 1.2, center.x)),
        y: Math.max(buttonSize * 0.6, center.y - hexHeight / 2 - buttonSize * 0.65) + 1
    })
    const selected = $derived(followUp.options.find((option) => option.id === followUp.selected))
</script>

<span class="hex-anchor" hidden use:trackHex={followUp.locationId}></span>
{#if width}
    <div
        class="choice"
        role="group"
        aria-label={followUp.label}
        transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
    >
        {#if arc}
            {#each followUp.options as option, index (option.id)}
                {@const chosen = option.id === followUp.selected}
                {@const point = chosen ? center : (arc.points[index] ?? center)}
                {@const size = chosen ? tileSize : arc.size}
                {#if option.tile}<button
                        class="tile-choice"
                        class:chosen
                        aria-pressed={chosen}
                        aria-label={option.label}
                        title={option.label}
                        tabindex={chosen ? -1 : 0}
                        style:translate={`${point.x}px ${point.y}px`}
                        style:width={`${size}px`}
                        style:height={`${size}px`}
                        onclick={() => followUp.select?.(option.id)}
                        ><Tile
                            face={option.tile.face}
                            rotation={option.tile.rotation}
                            layout={option.tile.layout}
                            {orientation}
                            {appearance}
                            {size}
                        /></button
                    >{/if}
            {/each}
        {/if}
        <HexPickerControls
            at={controls}
            size={buttonSize}
            cancel={{ label: 'Cancel', onclick: () => followUp.cancel() }}
            accept={selected
                ? {
                      label: `Accept: ${selected.label}`,
                      onclick: () => followUp.choose(selected.id)
                  }
                : undefined}
        />
    </div>
{/if}

<style>
    .choice {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 5;
        overflow: hidden;
        transform: translateZ(0);
    }
    .tile-choice {
        position: absolute;
        left: 0;
        top: 0;
        transition: translate 100ms ease-out;
        transform: translate(-50%, -50%);
        padding: 0;
        border: 0;
        background: transparent;
        filter: drop-shadow(0 2px 4px #0009);
        pointer-events: auto;
        cursor: pointer;
    }
    /* The tile shown over the hex lets taps through, so a tap on the hex moves to the next line. */
    .tile-choice.chosen {
        pointer-events: none;
        filter: none;
        z-index: 1;
    }
    .tile-choice:not(.chosen):hover > :global(svg) {
        transform: scale(1.1);
    }
    .tile-choice > :global(svg) {
        transition: transform 120ms ease-out;
        transform-origin: center;
    }
    @media (prefers-reduced-motion: reduce) {
        .tile-choice,
        .tile-choice > :global(svg) {
            transition: none;
        }
    }
    .tile-choice:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 3px;
    }
</style>
