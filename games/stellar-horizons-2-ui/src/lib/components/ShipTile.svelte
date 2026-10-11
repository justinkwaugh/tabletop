<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ShipKind, type ShipDefinition } from '@tabletop/stellar-horizons-2'
    import { SHIP_ART } from '$lib/art/manifest.js'

    let {
        ship,
        selected = false,
        named = true,
        label,
        disabled = false,
        onclick,
        children
    }: {
        ship: ShipDefinition
        selected?: boolean
        named?: boolean
        label?: string
        disabled?: boolean
        onclick?: () => void
        children?: Snippet
    } = $props()

    const traits = $derived(
        [
            ship.kind === ShipKind.RE ? 'Robotic explorer' : `Crew vehicle ${ship.size}`,
            ship.fast ? 'fast' : undefined,
            `exploration ${ship.exploration}`,
            ship.cargo > 0 ? `cargo ${ship.cargo}` : undefined
        ]
            .filter(Boolean)
            .join(', ')
    )
</script>

<div class="ship-tile" class:selected class:unnamed={!named} title="{ship.name}: {traits}">
    {#if onclick}
        <button type="button" class="art" aria-label={label} {disabled} {onclick}>
            <img src={SHIP_ART[ship.id]} alt={ship.name} />
        </button>
    {:else}
        <img src={SHIP_ART[ship.id]} alt={ship.name} />
    {/if}
    {#if named}
        <div class="name">{ship.name}</div>
    {/if}
    {@render children?.()}
</div>

<style>
    .ship-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 104px;
    }

    .ship-tile.unnamed {
        width: auto;
        margin: 0 2px;
    }

    .ship-tile img {
        width: 79px;
        height: 79px;
        border-radius: 6px;
        display: block;
    }

    /* The step panel styles every button as a boxed control; a counter is its own button. */
    .ship-tile button.art {
        padding: 0;
        border: none;
        background: none;
        border-radius: 6px;
        outline: 2px solid transparent;
        outline-offset: 1px;
        transition:
            transform 120ms ease,
            outline-color 120ms ease;
    }

    .ship-tile button.art:not(:disabled):hover {
        background: none;
        outline-color: #7fd3ff;
        transform: translateY(-2px);
    }

    .ship-tile button.art:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .ship-tile.selected button.art {
        outline-color: #ffd65a;
    }

    .name {
        font-size: 12px;
        color: #e8f1ff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
</style>
