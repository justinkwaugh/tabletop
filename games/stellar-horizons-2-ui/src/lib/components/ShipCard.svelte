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
            ship.fast ? 'fast' : undefined
        ]
            .filter(Boolean)
            .join(', ')
    )
</script>

<div class="ship-card" class:selected>
    <button type="button" class="art" {onclick} disabled={!onclick} title={traits}>
        <img src={SHIP_ART[ship.id]} alt={ship.name} />
    </button>
    <div class="details">
        <div class="name">{ship.name}</div>
        <div class="traits">{traits}</div>
        {@render children?.()}
    </div>
</div>

<style>
    .ship-card {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 3px 8px 3px 3px;
        border: 1px solid #22314d;
        border-radius: 10px;
        background: #121c30;
    }

    .ship-card.selected {
        border-color: #ffd65a;
    }

    .art {
        flex-shrink: 0;
        padding: 0;
        border: none;
        background: none;
        border-radius: 6px;
    }

    .art:disabled {
        cursor: default;
    }

    .art img {
        width: 78px;
        height: 64px;
        display: block;
    }

    .details {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 120px;
    }

    .name {
        font-weight: 700;
        color: #e8f1ff;
    }

    .traits {
        font-size: 12px;
        color: #8fa4c2;
    }
</style>
