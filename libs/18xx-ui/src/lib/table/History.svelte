<script lang="ts">
    import { assertExists, type GameAction } from '@tabletop/common'
    import { auctionHistory } from './auctionHistory.js'
    import AuctionHistoryCard from './AuctionHistoryCard.svelte'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const entries = $derived(
        auctionHistory(session.actions, session.financialState.offerAuction?.awards ?? [])
    )
    function select(action: GameAction) {
        if (action.index !== undefined) session.history.goToActionIndex(action.index)
    }
    function lot(lotId: string) {
        const lot = session.offerAuction?.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Auction history requires a known offered lot')
        return lot
    }
</script>

<ol aria-label="Action history">
    {#each entries as entry (entry.id)}
        {#if entry.kind === 'auction'}
            <li class="auction">
                <AuctionHistoryCard
                    card={entry}
                    lot={lot(entry.offer.lotId)}
                    playerName={(id) => session.getPlayerName(id)}
                    disabled={session.busy || session.updatingVisibleState}
                    onSelect={select}
                />
            </li>
        {:else}
            {@const action = entry.action}
            <li>
                <button
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        action.index === undefined}
                    onclick={() => {
                        if (action.index !== undefined)
                            session.history.goToActionIndex(action.index)
                    }}
                >
                    <span>{session.getPlayerName(action.playerId)}</span>
                    <strong>{action.type.replace(/([a-z])([A-Z])/g, '$1 $2')}</strong>
                    {#if 'locationId' in action && typeof action.locationId === 'string'}<small
                            >{action.locationId}</small
                        >{/if}
                </button>
            </li>
        {/if}
    {:else}<li class="empty">No actions yet.</li>{/each}
</ol>

<style>
    ol {
        list-style: none;
        padding: 8px 0;
        margin: 0;
    }
    li {
        border-bottom: 1px solid #d4c9bc;
    }
    li.auction {
        border-bottom: 0;
    }
    button {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px;
        padding: 12px 8px;
        text-align: left;
        background: none;
        border: 0;
        color: #3e3933;
        cursor: pointer;
        font: inherit;
    }
    button:hover {
        background: #ffffff55;
    }
    span {
        grid-column: 1 / -1;
        font-size: 11px;
        color: #7d7266;
    }
    strong {
        font-size: 13px;
        font-weight: 500;
    }
    small {
        font-size: 12px;
    }
    .empty {
        padding: 20px 8px;
        color: #7d7266;
        font-size: 13px;
    }
</style>
