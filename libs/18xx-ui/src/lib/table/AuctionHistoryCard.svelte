<script lang="ts">
    import PlayerName from './PlayerName.svelte'
    import './historyCard.css'
    import type { AuctionLot } from '@tabletop/18xx'
    import type { AuctionHistoryCard } from './auctionHistory.js'
    let {
        card,
        lot,
        playerName,
        playerColor,
    }: {
        card: AuctionHistoryCard
        lot: AuctionLot
        playerName: (id: string) => string
        playerColor: (id: string) => string
    } = $props()
</script>

<article class="history-card" aria-label={`${lot.name} auction history`}>
    <header class="history-card-header">
        <div class="history-entry"
        >
            <strong><PlayerName name={playerName(card.offer.playerId)} color={playerColor(card.offer.playerId)} dotSize={10} maxWidth="none" /></strong> offered <strong>{lot.name}</strong> for
            auction
        </div>
    </header>
    <div class="events">
        {#each card.events as event (event.id)}
            <div class="history-entry"
            >
                <span><PlayerName name={playerName(event.playerId)} color={playerColor(event.playerId)} dotSize={10} maxWidth="none" /></span>
                {#if event.type === 'BidOnAuctionLot'}<span
                        >bid <strong>${event.amount.toLocaleString('en-US')}</strong></span
                    >{:else}<span class="passed">passed</span>{/if}
            </div>
        {/each}
        {#if card.award && card.resolution}
            <div
                class="history-entry winner"
            >
                <strong><PlayerName name={playerName(card.award.playerId)} color={playerColor(card.award.playerId)} dotSize={10} maxWidth="none" /> won</strong><strong
                    >${card.award.price.toLocaleString('en-US')}</strong
                >
            </div>
        {:else if !card.events.length}<div class="initial">
                Starting value <strong>${lot.price.toLocaleString('en-US')}</strong>
            </div>{/if}
    </div>
</article>

<style>
    article {
        margin: var(--history-item-gap, 5px) 0;
        background: transparent;
        color: var(--rail-text, #514538);
        font-size: 12px;
        line-height: 1.4;
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
