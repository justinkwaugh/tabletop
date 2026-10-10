<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/pieceLayout.js'
    import Block from './board/Block.svelte'

    let {
        playerId,
        face,
        selected = false,
        dimmed = false,
        marker,
        label,
        compact = false,
        onclick
    }: {
        playerId: string
        face?: Face
        selected?: boolean
        dimmed?: boolean
        marker?: string
        label: string
        compact?: boolean
        onclick?: () => void
    } = $props()

    const gameSession = getGameSession()
    const PAD = 3
    const scale = $derived(compact ? 0.82 : 1)
</script>

<button
    type="button"
    class="nt-unit-tile"
    class:nt-unit-tile-selected={selected}
    disabled={!onclick}
    aria-label={label}
    aria-pressed={selected}
    {onclick}
>
    <svg
        width={(BLOCK_LENGTH + PAD * 2) * scale}
        height={(BLOCK_THICKNESS + PAD * 2) * scale}
        viewBox="{-BLOCK_LENGTH / 2 - PAD} {-BLOCK_THICKNESS / 2 - PAD} {BLOCK_LENGTH +
            PAD * 2} {BLOCK_THICKNESS + PAD * 2}"
    >
        <Block x={0} y={0} angle={0} colors={gameSession.armyColors(playerId)} {face} {dimmed} />
    </svg>
    {#if marker}
        <span class="nt-unit-tile-marker">{marker}</span>
    {/if}
</button>

<style>
    .nt-unit-tile {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        border: 2px solid transparent;
        border-radius: 4px;
        padding: 1px;
        background: transparent;
        line-height: 1;
    }

    .nt-unit-tile:not(:disabled) {
        cursor: pointer;
    }

    .nt-unit-tile:not(:disabled):hover {
        border-color: rgba(43, 38, 32, 0.35);
    }

    .nt-unit-tile-selected,
    .nt-unit-tile-selected:not(:disabled):hover {
        border-color: #2b2620;
    }

    .nt-unit-tile-marker {
        font-size: 10px;
        color: #2b2620;
        padding-top: 1px;
    }
</style>
