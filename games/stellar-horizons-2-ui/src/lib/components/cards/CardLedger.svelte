<script lang="ts">
    import {
        CardDeck,
        cardDefinition,
        deckName,
        deckShortName,
        romanLevel
    } from '@tabletop/stellar-horizons-2'
    import { CARD_ART, CARD_BACK_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'
    import { cardLedger, unavailabilityText, type CardRow } from '$lib/utils/cards.js'
    import CardDetails from './CardDetails.svelte'

    // A console's cards: Owned and Hand tabs, each a list grouped by deck with the card's level,
    // name, effect and points, and for the viewer's own hand the cost now. A row opens the
    // printed card. Everyone sees what a player owns; another player's hand shows as backs.
    let { playerId, mine }: { playerId: string; mine: boolean } = $props()

    const gameSession = getGameSession()
    const ledger = $derived(cardLedger(gameSession.gameState, playerId, mine))

    let tab: 'owned' | 'hand' = $state('owned')
    let opened: number | undefined = $state()
    const rows = $derived(tab === 'owned' ? ledger.owned : ledger.hand)
    const groups = $derived(
        [CardDeck.Fleet, CardDeck.Genetic]
            .map((deck) => ({
                deck,
                rows: rows
                    .map((row, index) => ({ row, index }))
                    .filter(({ row }) => row.deck === deck)
            }))
            .filter((group) => group.rows.length > 0)
    )
    const DECK_COLORS: Record<CardDeck, string> = {
        [CardDeck.Fleet]: '#6f6140',
        [CardDeck.Genetic]: '#4f6b34'
    }
</script>

{#snippet line(row: CardRow, index: number)}
    {@const card = row.cardId ? cardDefinition(row.cardId) : undefined}
    <button type="button" class="row" onclick={() => (opened = index)}>
        <img
            src={row.cardId ? CARD_ART[row.cardId] : CARD_BACK_ART[`${row.deck}-${row.level}`]}
            alt=""
            width="34"
            height="47"
        />
        <span class="main">
            <span class="title">
                <span class="level" style:background={DECK_COLORS[row.deck]}
                    >{romanLevel(row.level)}</span
                >
                {card ? card.name : `${deckShortName(row.deck)} card, face down`}
            </span>
            {#if card}
                <span class="text">{card.text}</span>
            {/if}
            {#if row.cardId && row.unavailable}
                <span class="blocked">{unavailabilityText(row.cardId, row.unavailable)}</span>
            {/if}
        </span>
        {#if card}
            <span class="side">
                <span class="points" title="{card.points} victory points">★ {card.points}</span>
                {#if row.cost !== undefined}
                    <span
                        class="cost"
                        style:background={FIELD_COLORS[card.field]}
                        title="Costs you {row.cost} {card.field.toLowerCase()} points now"
                        >{row.cost}</span
                    >
                {/if}
            </span>
        {/if}
    </button>
{/snippet}

<div class="ledger">
    <div class="tabs" role="tablist" aria-label="Cards">
        <button
            type="button"
            role="tab"
            aria-selected={tab === 'owned'}
            onclick={() => (tab = 'owned')}>Owned <span>{ledger.owned.length}</span></button
        >
        <button
            type="button"
            role="tab"
            aria-selected={tab === 'hand'}
            onclick={() => (tab = 'hand')}>Hand <span>{ledger.hand.length}</span></button
        >
    </div>
    {#each groups as group (group.deck)}
        <div class="deck">{deckName(group.deck)}s</div>
        {#each group.rows as { row, index } (row.key)}
            {@render line(row, index)}
        {/each}
    {:else}
        <div class="note">{tab === 'owned' ? 'No cards owned' : 'No cards in hand'}</div>
    {/each}
</div>

<CardDetails {rows} bind:index={opened} />

<style>
    .ledger {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 4px;
        border-bottom: 1px solid #1a2438;
    }

    .tabs button {
        padding: 4px 10px;
        border-bottom: 2px solid transparent;
        color: #9fb4d0;
        font-size: 13px;
        font-weight: 700;
    }

    .tabs button span {
        color: #7f93b0;
        font-weight: 400;
    }

    .tabs button[aria-selected='true'] {
        border-bottom-color: #7fd3ff;
        color: #dbe7f5;
    }

    .deck {
        margin-top: 4px;
        color: #7f93b0;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 5px 4px;
        border-radius: 6px;
        text-align: left;
    }

    .row:hover {
        background: #111b2e;
    }

    .row img {
        width: 34px;
        height: auto;
        flex-shrink: 0;
    }

    .main {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #dbe7f5;
        font-size: 13px;
        font-weight: 700;
    }

    .level {
        padding: 0 5px;
        border-radius: 3px;
        color: #fbf3df;
        font-size: 10.5px;
        letter-spacing: 0.06em;
    }

    .text {
        color: #b5c5dc;
        font-size: 12px;
        font-style: italic;
        line-height: 1.3;
    }

    .blocked {
        color: #f0b49a;
        font-size: 11.5px;
    }

    .side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        font-size: 12px;
    }

    .points {
        color: #f4c430;
        font-weight: 700;
        white-space: nowrap;
    }

    .cost {
        min-width: 22px;
        padding: 0 4px;
        border-radius: 999px;
        color: #fff;
        font-weight: 800;
        text-align: center;
    }

    .note {
        color: #7f93b0;
        font-size: 13px;
    }
</style>
