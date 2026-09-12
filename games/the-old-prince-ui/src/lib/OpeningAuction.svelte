<script lang="ts">
    import { OfferAuctionPanel, type FinanceExampleSession } from '@tabletop/18xx-ui'
    let { session, showUndo = true }: { session: FinanceExampleSession; showUndo?: boolean } =
        $props()
    const state = $derived(session.financialState)
</script>

{#if session.offerAuction && !session.offerAuction.auction.completed}
    <p class="company-roles">
        {#each state.companies.filter((company) => company.role) as company}
            <span>
                {company.role === 'mainline' ? 'Mainline' : 'Shortline'}:
                <strong>{company.name}</strong>
            </span>
        {/each}
    </p>
    <OfferAuctionPanel
        model={session.offerAuction}
        playerId={session.myPlayer?.id}
        playerName={(id) => session.getPlayerName(id)}
        draft={session.offerSelection}
        disabled={!session.canOfferAuction}
        onChoose={(id) => session.selectOffer(id)}
        onBidChange={(amount) => session.setOfferBid(amount)}
        onConfirm={() => session.confirmOffer()}
        onBack={() => session.backOffer()}
        onPass={() => session.passOffer()}
        onUndo={() => session.undo()}
        {showUndo}
        canUndo={!session.busy &&
            !session.isViewingHistory &&
            Boolean(session.offerSelection || session.undoableAction)}
    />
{/if}

<style>
    .company-roles {
        display: flex;
        gap: 24px;
    }
</style>
