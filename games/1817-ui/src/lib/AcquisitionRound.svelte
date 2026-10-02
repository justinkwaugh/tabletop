<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import { EighteenSeventeenLoanRules } from '@tabletop/1817'
    import RoundPanel from './RoundPanel.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session, companyId }: { session: EighteenSeventeenSession; companyId: string } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const offer = $derived(session.acquisitionOffer)
    const sale = $derived(session.companySale)
    const choice = $derived(session.acquirerChoice)
    const acquisition = $derived(session.buyerLoans)
    const zones = {
        offered: 'Offered for sale',
        acquisition: 'Acquisition zone',
        liquidation: 'Liquidation'
    }
    let amount = $derived(sale?.minimum ?? 0)
</script>

<RoundPanel {session} label="Acquisition round" {companyId}>
    {#if offer}
        <p>Put it up for sale from {money(offer.openingBid)}?</p>
    {/if}
    {#if sale}
        <p>
            {zones[sale.kind]} ·
            {#if sale.highBid}High bid {money(sale.highBid.amount)} by {session.getPlayerName(
                    sale.highBid.playerId
                )}{:else}No bids yet{/if}
        </p>
    {/if}
    {#if acquisition}
        <p>
            {getCompany(gameState, acquisition.buyerId).name} paid {money(acquisition.price)} · Loans
            {session.loans.loans(acquisition.buyerId)}/{session.loans.capacity(acquisition.buyerId)}
            · Took on {acquisition.inheritedLoans}, repaid {acquisition.repaidLoans}
        </p>
    {/if}
    {#if valid.length}
        <div class="choices">
            {#if offer}
                <button disabled={busy} onclick={() => session.offerCompany()}
                    >Offer for sale</button
                >
                <button disabled={busy} onclick={() => session.declineOffer()}>Keep</button>
            {/if}
            {#if sale && valid.includes('BidToAcquire')}
                <label
                    >Bid <input
                        type="number"
                        aria-label="Bid amount"
                        min={sale.minimum}
                        max={sale.maximum}
                        step="10"
                        bind:value={amount}
                    /></label
                >
                <button disabled={busy} onclick={() => session.bidToAcquire(amount)}
                    >Bid {money(amount)}</button
                >
                <button disabled={busy} onclick={() => session.passOnCompany()}>Pass</button>
            {/if}
            {#if choice}
                {#each choice.buyerIds as buyerId (buyerId)}
                    <button disabled={busy} onclick={() => session.acquireCompany(buyerId)}
                        >Buy with {getCompany(gameState, buyerId).name}</button
                    >
                {/each}
            {/if}
            {#if acquisition && valid.includes('FinishAcquisitionLoans')}
                {#if valid.includes('TakeLoan')}<button
                        disabled={busy}
                        onclick={() => session.loans.take(acquisition.buyerId)}>Take a loan</button
                    >{/if}
                {#if valid.includes('RepayAcquiredLoan')}<button
                        disabled={busy}
                        onclick={() => session.repayAcquiredLoan()}
                        >Repay a loan it took on ({money(EighteenSeventeenLoanRules.value)})</button
                    >{/if}
                <button disabled={busy} onclick={() => session.finishAcquisitionLoans()}
                    >Finish</button
                >
            {/if}
        </div>
    {/if}
</RoundPanel>

<style>
    input {
        width: 6em;
        margin-left: 4px;
        padding: 3px 6px;
        font: inherit;
        color: inherit;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 5px;
    }
</style>
