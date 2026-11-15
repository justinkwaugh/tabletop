<script lang="ts">
    import { cardDefinition, deckName, romanLevel } from '@tabletop/stellar-horizons-2'
    import { CARD_ART, CARD_BACK_ART } from '$lib/art/manifest.js'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'
    import { unavailabilityText, type CardRow } from '$lib/utils/cards.js'

    // A card as printed, at a readable size, beside what the ledger knows of it: its effect,
    // points and printed cost, and for one in the viewer's hand what it costs them now and
    // whether they can buy it. ◀ ▶ (or the arrow keys) step through the rows it was opened from.
    let {
        rows,
        index = $bindable()
    }: {
        rows: CardRow[]
        index: number | undefined
    } = $props()

    let dialog: HTMLDialogElement | undefined = $state()
    const row = $derived(index === undefined ? undefined : rows[index])

    $effect(() => {
        if (!dialog) return
        if (row && !dialog.open) dialog.showModal()
        if (!row && dialog.open) dialog.close()
    })

    function step(change: number) {
        if (index === undefined) return
        index = (index + change + rows.length) % rows.length
    }
</script>

<dialog
    bind:this={dialog}
    aria-label="Card"
    onclose={() => (index = undefined)}
    onclick={(event) => {
        if (event.target === dialog) index = undefined
    }}
    onkeydown={(event) => {
        if (event.key === 'ArrowLeft') step(-1)
        if (event.key === 'ArrowRight') step(1)
    }}
>
    {#if row}
        {@const card = row.cardId ? cardDefinition(row.cardId) : undefined}
        <div class="body">
            <img
                src={row.cardId ? CARD_ART[row.cardId] : CARD_BACK_ART[`${row.deck}-${row.level}`]}
                alt=""
                width="253"
                height="348"
            />
            <div class="info">
                {#if card && row.cardId}
                    <h3>{card.name} <span>{romanLevel(card.level)}</span></h3>
                    <div class="deck">{deckName(card.deck)}, level {card.level}</div>
                    <p class="text">{card.text}</p>
                    <dl>
                        <dt>Points</dt>
                        <dd>★ {card.points} VP</dd>
                        <dt>Printed cost</dt>
                        <dd>{card.cost} {card.field.toLowerCase()} points</dd>
                        {#if row.cost !== undefined}
                            <dt>Costs you now</dt>
                            <dd>
                                <span class="cost" style:background={FIELD_COLORS[card.field]}
                                    >{row.cost}</span
                                >
                                {card.field.toLowerCase()} points
                            </dd>
                        {/if}
                    </dl>
                    {#if row.cost !== undefined}
                        <div class="status" class:blocked={row.unavailable}>
                            {row.unavailable
                                ? unavailabilityText(row.cardId, row.unavailable)
                                : 'In your hand: can be bought in the develop-techs phase'}
                        </div>
                    {/if}
                {:else}
                    <h3>{deckName(row.deck)} <span>{romanLevel(row.level)}</span></h3>
                    <p class="text">In this player's hand, face down.</p>
                {/if}
                <div class="nav">
                    {#if rows.length > 1}
                        <button type="button" onclick={() => step(-1)} aria-label="Previous card"
                            >◀</button
                        >
                        <span>{(index ?? 0) + 1} of {rows.length}</span>
                        <button type="button" onclick={() => step(1)} aria-label="Next card"
                            >▶</button
                        >
                    {/if}
                    <button type="button" class="close" onclick={() => (index = undefined)}
                        >Close</button
                    >
                </div>
            </div>
        </div>
    {/if}
</dialog>

<style>
    dialog {
        margin: auto;
        padding: 0;
        border: 1px solid #2a3a58;
        border-radius: 10px;
        background: #0b1220;
        color: #dbe7f5;
    }

    dialog::backdrop {
        background: rgb(3 6 12 / 0.7);
    }

    .body {
        display: flex;
        gap: 18px;
        padding: 16px;
    }

    img {
        width: 316px;
        height: auto;
        flex-shrink: 0;
    }

    .info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 260px;
    }

    h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
    }

    h3 span {
        color: #9fb4d0;
        font-size: 15px;
    }

    .deck {
        color: #9fb4d0;
        font-size: 13px;
        text-transform: capitalize;
    }

    .text {
        margin: 0;
        font-size: 15px;
        line-height: 1.4;
        font-style: italic;
    }

    dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 12px;
        margin: 0;
        font-size: 13px;
    }

    dt {
        color: #9fb4d0;
    }

    dd {
        margin: 0;
        font-weight: 700;
    }

    .cost {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 4px;
        border-radius: 999px;
        color: #fff;
        font-size: 12px;
    }

    .status {
        padding: 6px 8px;
        border-radius: 6px;
        background: #132a1c;
        color: #a6e3b8;
        font-size: 13px;
    }

    .status.blocked {
        background: #2a1a14;
        color: #f0b49a;
    }

    .nav {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: auto;
        font-size: 13px;
    }

    .nav button {
        padding: 3px 10px;
        border: 1px solid #2a3a58;
        border-radius: 999px;
        color: #dbe7f5;
    }

    .nav .close {
        margin-left: auto;
    }

    @media (max-width: 40rem) {
        .body {
            flex-direction: column;
            align-items: center;
        }

        img {
            width: 220px;
        }

        .info {
            width: auto;
        }
    }
</style>
