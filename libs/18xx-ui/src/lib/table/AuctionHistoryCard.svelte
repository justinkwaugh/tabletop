<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import './historyCard.css'
    import './playerTint.css'
    import type { AuctionLot } from '@tabletop/18xx'
    import type { AuctionHistoryCard } from './auctionHistory.js'
    let {
        money,
        card,
        lot,
        playerName,
        playerColor
    }: {
        money: MoneyFormat
        card: AuctionHistoryCard
        lot: AuctionLot
        playerName: (id: string) => string
        playerColor: (id: string) => string
    } = $props()
</script>

<article class="history-card" aria-label={`${lot.name} auction history`}>
    <header
        class="history-card-header player-tinted-header"
        style:--player-color={playerColor(card.offer.playerId)}
    >
        <div class="history-entry">
            <strong>{playerName(card.offer.playerId)}</strong> offered <strong>{lot.name}</strong> for
            auction
        </div>
    </header>
    <div class="events">
        {#each card.events as event (event.id)}
            <div class="history-entry">
                <span>{playerName(event.playerId)}</span>
                {#if event.type === 'BidOnAuctionLot'}<span
                        >bid <strong>{money(event.amount)}</strong></span
                    >{:else}<span class="passed">passed</span>{/if}
            </div>
        {/each}
        {#if card.award && card.resolution}
            <div class="history-entry winner">
                <strong>{playerName(card.award.playerId)} won</strong><strong
                    >{money(card.award.price)}</strong
                >
            </div>
        {:else if !card.events.length}<div class="initial">
                Starting value <strong>{money(lot.price)}</strong>
            </div>{/if}
    </div>
</article>

<style>
    article {
        border: 0;
        border-radius: 0;
        margin: var(--history-item-gap, 5px) 0;
        background: transparent;
        color: var(--rail-text, #514538);
        font-size: 12px;
        line-height: 1.4;
    }
    .history-card-header {
        border-radius: 0;
    }
    header .history-entry {
        padding: 0;
    }
    .history-entry {
        width: 100%;
        box-sizing: border-box;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        padding: 3px 6px;
    }
    strong {
        font-weight: 600;
    }
    .events {
        padding: 3px 0;
    }
    .events .history-entry,
    .initial {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 6px;
    }
    .passed,
    .initial {
        color: var(--rail-muted, #887664);
    }
    .events .history-entry.winner {
        border-top: 1px solid var(--rail-border, #e3d9cd);
        margin-top: 3px;
        padding-top: 3px;
    }
</style>
