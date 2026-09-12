<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: FinanceExampleSession } =
        $props()
    const funding = $derived(session.financialState.trainFunding)
    const choice = $derived(session.fundingChoice)
    const bankruptcy = $derived(session.financialState.bankruptcy)
</script>

{#if funding || session.fundingPurchases.length}
    <section aria-label="Compulsory train funding">
        <header>
            <h2>{bankruptcy ? 'Bankruptcy' : 'Compulsory train funding'}</h2>
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        session.isViewingHistory ||
                        !session.actions.length}>Undo</button
                >{/if}
        </header>
        {#if bankruptcy}
            <p>
                {session.ownerName({ kind: 'player', playerId: bankruptcy.playerId })} cannot fund {getCompany(
                    session.financialState,
                    bankruptcy.companyId
                ).name}’s required train. The game has ended with a ${bankruptcy.shortfall} shortfall.
            </p>
        {:else if funding}
            <p>
                {getCompany(session.financialState, funding.purchase.companyId).name} must buy a {session.trainDepot.trainDefinition(
                    funding.purchase.definitionId
                ).name} for ${funding.purchase.price}. Remaining shortfall: ${session.funding.shortfall()}.
            </p>
            <p>
                Contributions: {funding.contributors
                    .map((owner) => session.ownerName(owner))
                    .join(' → ')}
            </p>
            {#if session.isViewingHistory}<p>History view</p>{/if}
            {#if choice?.kind === 'issue'}
                <p>
                    Issue all {choice.details.sales[0].shares} treasury shares for ${choice.details
                        .proceeds}.
                </p>
                <button
                    disabled={!session.canResolveFunding}
                    onclick={() => session.resolveTrainFunding()}>Issue treasury shares</button
                >
            {:else if choice?.kind === 'contribute'}
                <p>{session.ownerName(choice.owner)} must contribute ${choice.amount}.</p>
                <button
                    disabled={!session.canResolveFunding}
                    onclick={() => session.resolveTrainFunding()}
                    >Contribute ${choice.amount}</button
                >
            {:else if choice?.kind === 'sell'}
                <p>{session.ownerName(choice.owner)} must sell shares.</p>
                <div class="choices">
                    {#each choice.sales as sale}
                        <button
                            disabled={!session.canResolveFunding}
                            aria-pressed={session.fundingSale === sale}
                            onclick={() => session.selectFundingSale(sale)}
                            >Sell {sale.sales[0].shares}
                            {sale.sales[0].companyId} for ${sale.proceeds}</button
                        >
                    {/each}
                </div>
                {#if session.fundingSale}
                    <p>
                        Confirm sale of {session.fundingSale.sales[0].shares}
                        {session.fundingSale.sales[0].companyId} shares for ${session.fundingSale
                            .proceeds}.
                    </p>
                    <button onclick={() => session.backFundingSale()}>Back</button>
                    <button
                        disabled={!session.canResolveFunding}
                        onclick={() => session.resolveTrainFunding()}>Confirm share sale</button
                    >
                {/if}
            {:else if choice?.kind === 'buy'}
                <button
                    disabled={!session.canResolveFunding}
                    onclick={() => session.resolveTrainFunding()}>Buy required train</button
                >
            {/if}
        {:else}
            <p>
                The company needs a train and cannot afford the cheapest available bank train. Begin
                compulsory funding, or arrange a purchase from another company using treasury cash.
            </p>
            {#each session.fundingPurchases as purchase}
                <button disabled={!session.canFundTrain} onclick={() => session.fundTrain(purchase)}
                    >Fund {session.trainDepot.trainDefinition(purchase.definitionId).name} · ${purchase.price}</button
                >
            {/each}
        {/if}
    </section>
{/if}

<style>
    section {
        background: #fff6df;
        border: 1px solid #c5ad71;
        border-radius: 8px;
        padding: 16px;
        margin: 14px 0;
    }
    header,
    .choices {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    h2 {
        margin: 0;
        flex: 1;
    }
    button {
        padding: 8px 12px;
        margin: 3px;
        border: 1px solid #8d8b72;
        border-radius: 5px;
        background: white;
    }
    button:disabled {
        opacity: 0.45;
    }
    button[aria-pressed='true'] {
        background: #d9e7d5;
    }
</style>
