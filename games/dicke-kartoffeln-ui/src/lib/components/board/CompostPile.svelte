<script lang="ts">
    import type { FarmArea } from '$lib/utils/farmLayouts.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TOKEN_IMAGES } from '$lib/utils/tokens.js'
    import ImageTile from '../tokens/ImageTile.svelte'

    let {
        worms,
        change = 0,
        area,
        scale,
        label,
        readyYear
    }: {
        worms: number
        change?: number
        area: FarmArea
        scale: number
        label: string
        readyYear?: number
    } = $props()

    const gameSession = getGameSession()

    const size = $derived(Math.min(area.width, area.height) * scale * 0.42)
    const shown = $derived(worms + change)
</script>

<div
    class="pile"
    style:left="{area.cx * scale - (area.width * scale) / 2}px"
    style:top="{area.cy * scale - (area.height * scale) / 2}px"
    style:width="{area.width * scale}px"
    style:height="{area.height * scale}px"
    style:transform="rotate({area.rotation}deg)"
    aria-label="{label}: {shown} worms"
>
    {#if shown > 0}
        <ImageTile
            src={TOKEN_IMAGES.worm}
            alt="Worm"
            {size}
            width={size * 0.48}
            pending={change !== 0}
        />
        <span class="count" class:changed={change !== 0} style:font-size="{size * 0.5}px"
            >×{shown}</span
        >
    {/if}
    {#if readyYear !== undefined}
        {@const late = readyYear > gameSession.setup.years}
        <span
            class="ready"
            style:font-size="{size * 0.3}px"
            style:transform="translate(-50%, -50%) rotate({-90 - area.rotation}deg)"
            title={late
                ? 'Too late to spread: these worms count at the final scoring'
                : `Worms here can be spread in round 10 of year ${readyYear}`}
            >{late ? 'scores at end' : `yr ${readyYear} · rd 10`}</span
        >
    {/if}
</div>

<style>
    .pile {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transform-origin: center;
        pointer-events: none;
    }

    .count {
        border-radius: 6px;
        background: rgba(255, 250, 235, 0.92);
        padding: 0 4px;
        color: #4a2c16;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        line-height: 1.1;
    }

    /* The farm lies turned a quarter clockwise, so the tag runs upright along its left edge. */
    .ready {
        position: absolute;
        top: 50%;
        left: 0.75em;
        border-radius: 999px;
        background: rgba(74, 44, 22, 0.85);
        padding: 0 5px;
        color: #fff6dc;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        line-height: 1.2;
        white-space: nowrap;
        pointer-events: auto;
    }

    .count.changed {
        outline: 2px dashed #f6d55c;
    }
</style>
