<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import type { RoleMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/blockShape.js'
    import Block from './board/Block.svelte'

    let {
        playerId,
        face,
        selected = false,
        dimmed = false,
        marker,
        roleMark,
        seen = false,
        label,
        scale = 1,
        onclick
    }: {
        playerId: string
        face?: Face
        selected?: boolean
        dimmed?: boolean
        marker?: string
        roleMark?: RoleMark
        seen?: boolean
        label: string
        scale?: number
        onclick?: () => void
    } = $props()

    const gameSession = getGameSession()
    const PAD = 3
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
        <Block
            x={0}
            y={0}
            angle={0}
            colors={gameSession.armyColors(playerId)}
            {face}
            {dimmed}
            {roleMark}
            {seen}
        />
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
        border-color: color-mix(in srgb, var(--nt-ink) 35%, transparent);
    }

    .nt-unit-tile-selected,
    .nt-unit-tile-selected:not(:disabled):hover {
        border-color: var(--nt-ink);
    }

    .nt-unit-tile-marker {
        font-size: 10px;
        color: var(--nt-ink);
        padding-top: 1px;
    }
</style>
