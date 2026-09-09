<script lang="ts">
    import { getCompany, type Owner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    function ownerName(owner: Owner): string {
        if (owner.kind === 'player') return session.getPlayerName(owner.playerId)
        if (owner.kind === 'bank') return session.financialState.bank.name
        return getCompany(session.financialState, owner.companyId).name
    }
</script>

<section class="purchase" aria-label="Buy shares">
    <header>
        <h2>
            {session.financialState.machineState === 'BuyingShares'
                ? 'Buy shares'
                : 'Purchase complete'}
        </h2>
        <button
            onclick={() => session.undo()}
            disabled={session.busy ||
                session.isViewingHistory ||
                (!session.selection && !session.undoableAction)}>Undo</button
        >
    </header>
    {#if session.selectedPurchaseDetails}
        {@const details = session.selectedPurchaseDetails}
        <div class="confirmation" aria-label="Confirm share purchase">
            <p>
                <strong>{ownerName(details.buyer)}</strong> buys a certificate in
                <strong>{getCompany(session.financialState, details.companyId).name}</strong>
                from {ownerName(details.seller)} for {details.price}.
            </p>
            <ul>
                {#each details.payments as payment}<li>
                        {ownerName(payment.from)} pays {payment.amount} to {ownerName(payment.to)}.
                    </li>{/each}
            </ul>
            <button onclick={() => session.cancelPurchase()} disabled={session.busy}>Back</button>
            <button onclick={() => session.confirmPurchase()} disabled={session.busy}
                >Confirm purchase</button
            >
        </div>
    {:else if session.financialState.machineState === 'BuyingShares'}
        <p>{session.getPlayerName(session.financialState.activePlayerIds[0])}’s stock turn</p>
        <div class="choices">
            {#each session.purchaseChoices as choice (`${choice.request.buyer.kind === 'company' ? choice.request.buyer.companyId : choice.request.playerId}:${choice.certificate.id}`)}
                <button
                    class="choice"
                    data-purchase-certificate={choice.certificate.id}
                    data-buyer={choice.request.buyer.kind === 'company'
                        ? choice.request.buyer.companyId
                        : 'player'}
                    disabled={session.busy || !choice.result.details}
                    onclick={() => session.selectPurchase(choice.request)}
                >
                    <strong
                        >{getCompany(session.financialState, choice.certificate.companyId)
                            .name}</strong
                    >
                    <span
                        >{ownerName(choice.request.buyer)} · {session.financialState.certificatePools.find(
                            (pool) => pool.id === choice.certificate.poolId
                        )?.name}</span
                    >
                    <span
                        >{choice.result.details
                            ? `Buy for ${choice.result.details.price}`
                            : choice.result.reason}</span
                    >
                </button>
            {/each}
        </div>
    {/if}
    {#if session.purchases.length}<ol aria-label="Purchase history">
            {#each session.purchases as purchase (purchase.id)}
                {#if purchase.metadata}{@const details = purchase.metadata}
                    <li>
                        {ownerName(details.buyer)} bought {getCompany(
                            session.financialState,
                            details.companyId
                        ).name} for {details.price}.
                        {#each details.payments as payment}<span
                                >{ownerName(payment.from)} paid {payment.amount} to {ownerName(
                                    payment.to
                                )}.</span
                            >{/each}
                    </li>
                {/if}
            {/each}
        </ol>{/if}
</section>

<style>
    .purchase {
        padding: 16px;
        margin-bottom: 24px;
        background: #fffefa;
        border: 1px solid #c9d2cb;
        border-radius: 7px;
        font:
            14px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
        color: #253b35;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    h2 {
        margin: 0;
        font-size: 17px;
    }
    button {
        font: inherit;
        padding: 9px 12px;
        border: 1px solid #aebfb4;
        background: #edf3eb;
        border-radius: 5px;
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .choices {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
        gap: 8px;
    }
    .choice {
        text-align: left;
        overflow-wrap: anywhere;
    }
    span {
        display: block;
        font-size: 12px;
    }
    .confirmation button + button {
        margin-left: 8px;
    }
    ul,
    ol {
        padding-left: 22px;
    }
</style>
