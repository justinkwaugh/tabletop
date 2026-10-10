<script lang="ts">
    import type { Face, Side } from '@tabletop/napoleons-triumph'
    import { ARMY_COLORS } from '$lib/definitions/palette.js'
    import Block from './board/Block.svelte'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/pieceLayout.js'

    let {
        side,
        face,
        selected = false,
        dimmed = false,
        disabled = false,
        marker,
        label,
        compact = false,
        onclick
    }: {
        side: Side
        face?: Face
        selected?: boolean
        dimmed?: boolean
        disabled?: boolean
        /** A short note under the block, such as "leads" or "moved". */
        marker?: string
        label: string
        /** Drawn smaller, for dense lists. */
        compact?: boolean
        onclick?: () => void
    } = $props()

    const colors = $derived(ARMY_COLORS[side])
    const PAD = 3
    const scale = $derived(compact ? 0.82 : 1)
</script>

<button
    type="button"
    class="nt-unit-tile"
    class:nt-unit-tile-selected={selected}
    disabled={disabled || !onclick}
    aria-label={label}
    aria-pressed={selected}
    {onclick}
>
    <svg
        width={(BLOCK_LENGTH + PAD * 2) * scale}
        height={(BLOCK_THICKNESS + PAD * 2) * scale}
        viewBox="{-BLOCK_LENGTH / 2 - PAD} {-BLOCK_THICKNESS / 2 - PAD} {BLOCK_LENGTH + PAD * 2} {BLOCK_THICKNESS + PAD * 2}"
    >
        <Block x={0} y={0} angle={0} fill={colors.block} shade={colors.shade} ink={colors.ink} {face} {dimmed} />
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
