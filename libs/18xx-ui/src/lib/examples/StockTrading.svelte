<script lang="ts">
    import CompanyStarting from './CompanyStarting.svelte'
    import {
        getCompany,
        isBuyShares,
        isStartCompany,
        isFloatCompany,
        isSellShares,
        stockMarketSpace,
        type PresidencyChange
    } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const state = $derived(session.financialState)
</script>

{#snippet presidency(change: PresidencyChange)}
    <p class="presidency">
        President: {session.ownerName(change.previous)} → {session.ownerName(change.next)}. Exchange
        the president’s certificate for {change.exchangedCertificateIds.length} ordinary certificates.
    </p>
{/snippet}
<section class="trading" aria-label="Stock trading">
    <header>
        <h2>{state.machineState === 'TradingShares' ? 'Stock turn' : 'Turn complete'}</h2>
        <div class="buttons">
            {#if state.machineState === 'TradingShares'}<button
                    onclick={() => session.finishTurn()}
                    disabled={session.busy ||
                        session.isViewingHistory ||
                        !!session.selection ||
                        !session.validActionTypes.includes('FinishStockTurn')}>Finish turn</button
                >{/if}
            <button
                onclick={() => session.undo()}
                disabled={session.busy ||
                    session.isViewingHistory ||
                    (!session.selection && !session.undoableAction)}>Undo</button
            >
        </div>
    </header>
    {#if session.mustSell}<p role="status">
            Sell down to the stock limits before buying or finishing.
        </p>{/if}
    {#if session.selectedStartCompany}
        <CompanyStarting {session} />
    {:else if session.selectedPurchaseDetails}
        {@const details = session.selectedPurchaseDetails}
        <div aria-label="Confirm share purchase">
            <p>
                <strong>{session.ownerName(details.buyer)}</strong> buys a certificate in
                <strong>{getCompany(state, details.companyId).name}</strong>
                from {session.ownerName(details.seller)} for {details.price}.
            </p>
            <ul>
                {#each details.payments as payment}<li>
                        {session.ownerName(payment.from)} pays {payment.amount} to {session.ownerName(
                            payment.to
                        )}.
                    </li>{/each}
            </ul>
            {#if details.presidency}{@render presidency(details.presidency)}{/if}
            {#if session.selectedPurchaseFlotation}
                <div aria-label="Flotation preview">
                    <p>{getCompany(state, details.companyId).name} will float.</p>
                    {#each session.selectedPurchaseFlotation.payments as payment}<p>
                            {session.ownerName(payment.from)} pays {payment.amount} to {session.ownerName(
                                payment.to
                            )} as initial capital.
                        </p>{/each}
                </div>
            {/if}
            <div class="buttons">
                <button onclick={() => session.cancelSelection()} disabled={session.busy}
                    >Back</button
                ><button onclick={() => session.confirmPurchase()} disabled={session.busy}
                    >Confirm purchase</button
                >
            </div>
        </div>
    {:else if state.machineState === 'TradingShares'}
        <p>{session.getPlayerName(state.activePlayerIds[0])}’s stock turn</p>
        {#if session.selectedSale}
            <div class="preview" aria-label="Confirm share sale">
                <h3>Sale order</h3>
                <ol>
                    {#each session.selectedSale.sales as sale, index (sale.companyId)}
                        <li>
                            <strong>{getCompany(state, sale.companyId).name}</strong> · {sale.shares}
                            shares
                            <div class="buttons">
                                <button
                                    aria-label={`Move ${sale.companyId} earlier`}
                                    disabled={session.busy || index === 0}
                                    onclick={() => session.moveSale(sale.companyId, -1)}>↑</button
                                >
                                <button
                                    aria-label={`Move ${sale.companyId} later`}
                                    disabled={session.busy ||
                                        index === session.selectedSale.sales.length - 1}
                                    onclick={() => session.moveSale(sale.companyId, 1)}>↓</button
                                >
                                <button
                                    aria-label={`Remove ${sale.companyId} sale`}
                                    disabled={session.busy}
                                    onclick={() => session.removeSale(sale.companyId)}
                                    >Remove</button
                                >
                            </div>
                        </li>
                    {/each}
                </ol>
                <p>
                    Markers arriving together are stacked in this order, below markers already
                    there.
                </p>
                {#if session.selectedSaleResult?.details}
                    {@const details = session.selectedSaleResult.details}
                    <p>Total proceeds: <strong>{details.proceeds}</strong></p>
                    {#each details.sales as sale (sale.companyId)}
                        <p>
                            {getCompany(state, sale.companyId).name}: {sale.shares} × {sale.price} = {sale.proceeds}.
                            Market price: {sale.price} → {stockMarketSpace(
                                state.stockMarket,
                                sale.toMarketSpaceId
                            ).price}.
                        </p>
                        {#if sale.presidency}{@render presidency(sale.presidency)}{/if}
                    {/each}
                {:else}<p role="alert">{session.selectedSaleResult?.reason}</p>{/if}
                <div class="buttons">
                    <button onclick={() => session.cancelSelection()} disabled={session.busy}
                        >Back</button
                    ><button
                        onclick={() => session.confirmSale()}
                        disabled={session.busy || !session.selectedSaleResult?.details}
                        >Confirm sale</button
                    >
                </div>
            </div>
        {/if}
        {#if !session.selection}<CompanyStarting {session} />{/if}
        <details open>
            <summary>Sell shares</summary>
            <div class="choices">
                {#each session.saleChoices as choice (`${choice.request.seller.kind === 'company' ? choice.request.seller.companyId : choice.request.playerId}:${choice.sale.companyId}:${choice.sale.shares}`)}
                    <button
                        class="choice"
                        data-sale-company={choice.sale.companyId}
                        data-sale-shares={choice.sale.shares}
                        disabled={session.busy || !choice.result.details}
                        onclick={() => session.selectSale(choice.request)}
                    >
                        <strong>{getCompany(state, choice.sale.companyId).name}</strong>
                        <span
                            >{session.ownerName(choice.request.seller)} · {choice.sale.shares}
                            {choice.sale.shares === 1 ? 'share' : 'shares'}</span
                        >
                        <span
                            >{choice.result.details
                                ? `Sell for ${choice.result.details.proceeds}`
                                : choice.result.reason}</span
                        >
                    </button>
                {/each}
            </div>
        </details>
        {#if !session.selectedSale && !state.stockRound.turn.bought}
            <details open>
                <summary>Buy shares</summary>
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
                            <strong>{getCompany(state, choice.certificate.companyId).name}</strong>
                            <span
                                >{session.ownerName(choice.request.buyer)} · {state.certificatePools.find(
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
            </details>
        {/if}
    {/if}
    {#if session.trades.length}
        <ol aria-label="Stock history">
            {#each session.trades as trade (trade.id)}
                {#if isStartCompany(trade) && trade.metadata}
                    <li>
                        {session.ownerName(trade.metadata.buyer)} started {getCompany(
                            state,
                            trade.companyId
                        ).name} at {trade.metadata.parPrice}, paying {trade.metadata.price} for the president’s
                        certificate.
                    </li>
                {:else if isFloatCompany(trade) && trade.metadata}
                    <li>
                        {getCompany(state, trade.companyId).name} floated.
                        {#each trade.metadata.payments as payment}<span
                                >{session.ownerName(payment.from)} paid {payment.amount} to {session.ownerName(
                                    payment.to
                                )} as initial capital.</span
                            >{/each}
                    </li>
                {:else if isBuyShares(trade) && trade.metadata}
                    {@const details = trade.metadata}
                    <li>
                        {session.ownerName(details.buyer)} bought {getCompany(
                            state,
                            details.companyId
                        ).name} for {details.price}.
                        {#each details.payments as payment}<span
                                >{session.ownerName(payment.from)} paid {payment.amount} to {session.ownerName(
                                    payment.to
                                )}.</span
                            >{/each}
                        {#if details.presidency}{@render presidency(details.presidency)}{/if}
                    </li>
                {:else if isSellShares(trade) && trade.metadata}
                    {@const details = trade.metadata}
                    <li>
                        {session.ownerName(details.seller)} sold shares for {details.proceeds}.
                        {#each details.sales as sale}<span
                                >{getCompany(state, sale.companyId).name}: {sale.shares} shares at {sale.price};
                                market price {stockMarketSpace(
                                    state.stockMarket,
                                    sale.toMarketSpaceId
                                ).price}.</span
                            >
                            {#if sale.presidency}{@render presidency(sale.presidency)}{/if}
                        {/each}
                    </li>
                {/if}
            {/each}
        </ol>
    {/if}
</section>

<style>
    .trading {
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
    header,
    .buttons {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    header {
        justify-content: space-between;
    }
    h2 {
        margin: 0;
        font-size: 17px;
    }
    h3,
    summary {
        font-size: 14px;
        font-weight: 650;
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
        padding: 8px 0;
    }
    .choice {
        text-align: left;
        overflow-wrap: anywhere;
    }
    span {
        display: block;
        font-size: 12px;
    }
    ul,
    ol {
        padding-left: 22px;
    }
    li {
        margin-bottom: 8px;
    }
    .preview {
        padding: 12px;
        border: 1px solid #b7c7b6;
        margin-bottom: 16px;
    }
    .presidency {
        font-size: 12px;
    }
    summary {
        cursor: pointer;
        padding: 8px 0;
    }
</style>
