<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { ROOFTOP_SPRITE_NEUTRAL } from '$lib/model/session.svelte'
    import type { ActionIcon, ActionLine } from '$lib/utils/describeAction.js'
    import PieceIcon from './PieceIcon.svelte'
    import TileChip from './TileChip.svelte'

    let { line }: { line: ActionLine } = $props()

    const session = getGameSession()

    function iconSprite(icon: ActionIcon): string | undefined {
        switch (icon.kind) {
            case 'building':
                return `tall-${icon.color}-0`
            case 'rooftop':
                return icon.playerId
                    ? `${session.rooftopSprite({ coords: { x: 0, y: 0 }, playerId: icon.playerId })}-0`
                    : `${ROOFTOP_SPRITE_NEUTRAL}-0`
            case 'stable':
                return 'stable-0'
            case 'merchant':
                return 'merchant-0'
            case 'wall':
                return 'wall-h-0'
            case 'tea':
                return undefined
        }
    }

    const sprite = $derived(iconSprite(line.icon))
</script>

<div class="line">
    <span class="icon">
        {#if sprite}
            <PieceIcon name={sprite} height={22} maxWidth={26} />
        {:else}
            <TileChip name="tea" title="Tea tile" pixelHeight={22} />
        {/if}
    </span>
    <span class="text">
        {line.text}
        {#if line.notes.length > 0}
            <span class="notes">{line.notes.join(', ')}</span>
        {/if}
    </span>
</div>

<style>
    .line {
        display: flex;
        align-items: center;
        gap: 7px;
        font:
            500 17px/1.25 'Medina Body',
            system-ui,
            sans-serif;
    }

    .icon {
        display: flex;
        flex: none;
        justify-content: center;
        width: 28px;
    }

    .notes {
        opacity: 0.75;
    }

    .notes::before {
        content: ' · ';
    }
</style>
