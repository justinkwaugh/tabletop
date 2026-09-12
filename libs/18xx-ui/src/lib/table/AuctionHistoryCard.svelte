<script lang="ts">
    import type { AuctionLot } from '@tabletop/18xx'
    import type { GameAction } from '@tabletop/common'
    import type { AuctionHistoryCard } from './auctionHistory.js'
    let {
        card,
        lot,
        playerName,
        disabled,
        onSelect
    }: {
        card: AuctionHistoryCard
        lot: AuctionLot
        playerName: (id: string) => string
        disabled: boolean
        onSelect: (action: GameAction) => void
    } = $props()
</script>

<article aria-label={`${lot.name} auction history`}>
    <header>
        <button
            disabled={disabled || card.offer.index === undefined}
            onclick={() => onSelect(card.offer)}
        >
            <strong>{playerName(card.offer.playerId)}</strong> offered <strong>{lot.name}</strong> for
            auction
        </button>
    </header>
    <div class="events">
        {#each card.events as event (event.id)}
            <button
                disabled={disabled || event.index === undefined}
                onclick={() => onSelect(event)}
            >
                <span>{playerName(event.playerId)}</span>
                {#if event.type === 'BidOnAuctionLot'}<span
                        >bid <strong>${event.amount.toLocaleString('en-US')}</strong></span
                    >{:else}<span class="passed">passed</span>{/if}
            </button>
        {/each}
        {#if card.award && card.resolution}
            {@const resolution = card.resolution}
            <button
                class="winner"
                disabled={disabled || resolution.index === undefined}
                onclick={() => onSelect(resolution)}
            >
                <strong>{playerName(card.award.playerId)} won</strong><strong
                    >${card.award.price.toLocaleString('en-US')}</strong
                >
            </button>
        {:else if !card.events.length}<div class="initial">
                Starting value <strong>${lot.price.toLocaleString('en-US')}</strong>
            </div>{/if}
    </div>
</article>

<style>
    article {
        margin: 6px 4px;
        overflow: hidden;
        border: 1px solid #cbbca8;
        border-radius: 7px;
        background: #fffdf8;
        color: #514538;
        font-size: 12px;
        line-height: 1.4;
    }
    header {
        background: #efe7db;
    }
    button {
        width: 100%;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        padding: 5px 9px;
    }
    button:hover:not(:disabled) {
        background: #e7ddce66;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: -2px;
    }
    button:disabled {
        cursor: default;
    }
    strong {
        font-weight: 600;
    }
    .events {
        padding: 3px 0;
    }
    .events button,
    .initial {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 3px 9px;
    }
    .passed,
    .initial {
        color: #887664;
    }
    .events button.winner {
        border-top: 1px solid #e3d9cd;
        margin-top: 3px;
        padding-top: 6px;
    }
</style>
