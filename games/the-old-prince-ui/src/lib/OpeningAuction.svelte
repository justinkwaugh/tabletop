<script lang="ts">
    import { OfferAuctionPanel, type EighteenXXSessionView } from '@tabletop/18xx-ui'
    import { theOldPrinceCompanyRole, TheOldPrinceRoles } from '@tabletop/the-old-prince'
    let { session, showUndo = true }: { session: EighteenXXSessionView; showUndo?: boolean } =
        $props()
    const gameState = $derived(session.gameState)
</script>

{#if session.offers.model && !session.offers.model.auction.completed}
    <section class="centered-panel">
        <p class="company-roles">
            {#each gameState.companies as company (company.id)}
                {@const role = theOldPrinceCompanyRole(gameState, company.id)}
                {#if role}<span>
                        {TheOldPrinceRoles[role].name}:
                        <strong>{session.companyName(company.id)}</strong>
                    </span>{/if}
            {/each}
        </p>
        <OfferAuctionPanel
            model={session.offers.model}
            playerId={session.myPlayer?.id}
            playerName={(id) => session.getPlayerName(id)}
            selection={session.offers.selection}
            ownTurn={session.offers.ownTurn}
            disabled={!session.offers.canAct}
            onChoose={(id) => session.offers.select(id)}
            onBidChange={(amount) => session.offers.setBid(amount)}
            onConfirm={() => session.offers.confirm()}
            onBack={() => session.offers.choice.clear()}
            onPass={() => session.offers.pass()}
            onUndo={() => session.undo()}
            {showUndo}
            canUndo={!session.busy &&
                !session.isViewingHistory &&
                Boolean(session.offers.selection || session.undoableAction)}
        />
    </section>
{/if}

<style>
    .company-roles {
        display: flex;
        gap: 24px;
    }
</style>
