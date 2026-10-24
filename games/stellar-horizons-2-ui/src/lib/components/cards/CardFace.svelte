<script lang="ts">
    import { CardDeck, cardDefinition, romanLevel } from '@tabletop/stellar-horizons-2'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'

    // A fleet improvement or genetic manipulation as printed: its title and level on the deck's
    // band, its text, the points on the star and the cost in the circle of its tech type's
    // colour. With `cost` the circle shows what it costs the viewer now. With `onclick` the card
    // is a button.
    let {
        cardId,
        cost,
        disabled = false,
        note,
        compact = false,
        onclick
    }: {
        cardId: string
        cost?: number
        disabled?: boolean
        note?: string
        compact?: boolean
        onclick?: () => void
    } = $props()

    const card = $derived(cardDefinition(cardId))
    const price = $derived(cost ?? card.cost)
</script>

{#snippet face()}
    <span class="band" class:genetic={card.deck === CardDeck.Genetic}>
        <span class="name">{card.name}</span>
        <span class="level">{romanLevel(card.level)}</span>
    </span>
    {#if !compact}
        <span class="text">{card.text}</span>
        {#if card.waits}
            <span class="waits">{card.waits}</span>
        {/if}
    {/if}
    <span class="foot">
        <span class="points" title="{card.points} victory points">★ {card.points}</span>
        {#if note}
            <span class="note">{note}</span>
        {/if}
        <span
            class="cost"
            class:changed={price !== card.cost}
            style:background={FIELD_COLORS[card.field]}
            title="{price} {card.field.toLowerCase()} points">{price}</span
        >
    </span>
{/snippet}

{#if onclick}
    <button type="button" class="card" class:compact {disabled} {onclick}>{@render face()}</button>
{:else}
    <div class="card" class:compact>{@render face()}</div>
{/if}

<style>
    .card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 188px;
        box-sizing: border-box;
        margin: 0;
        padding: 0 0 6px;
        border: 1px solid #2a3a58;
        border-radius: 7px;
        background: #0b1220;
        color: #dbe7f5;
        text-align: left;
        overflow: hidden;
    }

    .card.compact {
        width: auto;
        min-width: 150px;
        gap: 4px;
        padding-bottom: 4px;
    }

    button.card {
        cursor: pointer;
    }

    button.card:disabled {
        cursor: default;
        opacity: 0.5;
    }

    .band {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 6px;
        padding: 4px 8px;
        background: #6f6140;
        color: #fbf3df;
        font-weight: 700;
        font-size: 13px;
    }

    .band.genetic {
        background: #4f6b34;
    }

    .level {
        font-size: 12px;
        letter-spacing: 0.08em;
    }

    .text {
        padding: 0 8px;
        font-size: 12px;
        line-height: 1.35;
        font-style: italic;
    }

    .waits {
        padding: 0 8px;
        font-size: 11px;
        line-height: 1.3;
        color: #8fa4c2;
    }

    .foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 0 8px;
        margin-top: auto;
    }

    .points {
        font-size: 13px;
        font-weight: 700;
        color: #f2c94c;
    }

    .note {
        font-size: 11px;
        color: #ff8a7a;
        text-align: center;
    }

    .cost {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        padding: 0 4px;
        box-sizing: border-box;
        border: 2px solid #f4f7fb;
        border-radius: 12px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
    }

    .cost.changed {
        border-color: #f2c94c;
    }
</style>
