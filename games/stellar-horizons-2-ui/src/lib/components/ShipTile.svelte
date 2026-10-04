<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ShipKind, type ShipDefinition } from '@tabletop/stellar-horizons-2'
    import { SHIP_ART } from '$lib/art/manifest.js'

    let {
        ship,
        selected = false,
        onclick,
        children
    }: {
        ship: ShipDefinition
        selected?: boolean
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

<div class="ship-tile" class:selected title="{ship.name}: {traits}">
    {#if onclick}
        <button type="button" class="art" {onclick}>
            <img src={SHIP_ART[ship.id]} alt={ship.name} />
        </button>
    {:else}
        <img src={SHIP_ART[ship.id]} alt={ship.name} />
    {/if}
    <div class="name">{ship.name}</div>
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

    .ship-tile img {
        width: 96px;
        height: 79px;
        border-radius: 6px;
        display: block;
    }

    .art {
        padding: 0;
        border: 2px solid transparent;
        background: none;
        border-radius: 8px;
    }

    .selected .art {
        border-color: #ffd65a;
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
