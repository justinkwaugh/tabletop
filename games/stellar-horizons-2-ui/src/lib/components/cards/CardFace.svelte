<script lang="ts">
    import { cardDefinition, romanLevel } from '@tabletop/stellar-horizons-2'
    import { CARD_ART } from '$lib/art/manifest.js'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'

    // A fleet improvement or genetic manipulation as printed, its art at `width`, with what it
    // costs the viewer now beneath it (the printed circle shows the printed cost) and, with
    // `note`, why it cannot be bought. With `onclick` the card is a button.
    let {
        cardId,
        cost,
        disabled = false,
        note,
        width = 180,
        onclick
    }: {
        cardId: string
        cost?: number
        disabled?: boolean
        note?: string
        width?: number
        onclick?: () => void
    } = $props()

    const card = $derived(cardDefinition(cardId))
    const label = $derived(
        `${card.name} ${romanLevel(card.level)}, ★ ${card.points}${cost !== undefined ? `, costs ${cost}` : ''}${note ? `, ${note}` : ''}`
    )
</script>

{#snippet face()}
    <img
        src={CARD_ART[cardId]}
        alt=""
        {width}
        height={Math.round((width * 348) / 253)}
        style:width="{width}px"
    />
    {#if cost !== undefined || note}
        <span class="foot">
            {#if cost !== undefined}
                <span class="cost"
                    >Costs <b style:background={FIELD_COLORS[card.field]}>{cost}</b
                    >{#if cost !== card.cost}<span class="printed">printed {card.cost}</span
                        >{/if}</span
                >
            {/if}
            {#if note}
                <span class="note">{note}</span>
            {/if}
        </span>
    {/if}
{/snippet}

{#if onclick}
    <button type="button" class="card" aria-label={label} {disabled} {onclick}
        >{@render face()}</button
    >
{:else}
    <div class="card" role="img" aria-label={label}>{@render face()}</div>
{/if}

<style>
    .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 0;
        color: #dbe7f5;
    }

    button.card {
        cursor: pointer;
    }

    button.card:disabled {
        cursor: default;
    }

    button.card:disabled img {
        opacity: 0.45;
    }

    img {
        display: block;
        height: auto;
    }

    .foot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 12px;
    }

    .cost {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .cost b {
        min-width: 24px;
        padding: 1px 5px;
        border-radius: 999px;
        color: #fff;
        font-weight: 800;
        text-align: center;
    }

    .printed {
        color: #7f93b0;
        font-size: 11px;
    }

    .note {
        color: #ff8a7a;
        font-size: 11.5px;
        text-align: center;
    }
</style>
