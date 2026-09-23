<script lang="ts">
    import StockRoundStatus from './StockRoundStatus.svelte'
    import CompanyStarting from './CompanyStarting.svelte'
    import {
        getCompany,
        isBuyShares,
        isStartCompany,
        isFloatCompany,
        isFinishStockTurn,
        isCompleteStockRound,
        isStartOperatingSet,
        isSellShares,
        stockMarketSpace,
        type PresidencyChange
    } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSession } = $props()
    const gameState = $derived(session.gameState)
</script>

{#snippet presidency(change: PresidencyChange)}
    <p class="presidency">
        President: {session.ownerName(change.previous)} → {session.ownerName(change.next)}. Exchange
        the president’s certificate for {change.exchangedCertificateIds.length} ordinary certificates.
    </p>
{/snippet}
<section class="trading" aria-label="Stock trading">
    <header>
        <h2>
            {gameState.machineState === 'StockRound'
                ? `Stock round ${gameState.stockRound.number}`
                : gameState.operatingSet
                  ? `Operating set ${gameState.operatingSet.number}`
                  : 'Starting operating set'}
        </h2>
        <div class="buttons">
            {#if gameState.machineState === 'StockRound'}<button
                    onclick={() => session.stock.finishTurn()}
                    disabled={session.busy ||
                        session.isViewingHistory ||
                        !!session.stock.hasSelection ||
                        !session.validActionTypes.includes('FinishStockTurn')}
                    >{gameState.stockRound.turn.acted ? 'End turn' : 'Pass'}</button
                >{/if}
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy ||
                        session.isViewingHistory ||
                        (!session.stock.hasSelection && !session.undoableAction)}>Undo</button
                >{/if}
        </div>
    </header>
    <StockRoundStatus {session} />
    {#if session.stock.mustSell}<p role="status">
            Sell down to the stock limits before buying or finishing.
        </p>{/if}
    {#if session.stock.selectedStartCompany}
        <CompanyStarting {session} />
    {:else if session.stock.selectedPurchaseDetails}
        {@const details = session.stock.selectedPurchaseDetails}
        <div aria-label="Confirm share purchase">
            <p>
                <strong>{session.ownerName(details.buyer)}</strong> buys a certificate in
                <strong>{getCompany(gameState, details.companyId).name}</strong>
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
            {#if session.stock.selectedPurchaseFlotation}
                <div aria-label="Flotation preview">
                    <p>{getCompany(gameState, details.companyId).name} will float.</p>
                    {#each session.stock.selectedPurchaseFlotation.payments as payment}<p>
                            {session.ownerName(payment.from)} pays {payment.amount} to {session.ownerName(
                                payment.to
                            )} as initial capital.
                        </p>{/each}
                </div>
            {/if}
            <div class="buttons">
                <button onclick={() => session.stock.cancel()} disabled={session.busy}>Back</button
                ><button onclick={() => session.stock.confirmPurchase()} disabled={session.busy}
                    >Confirm purchase</button
                >
            </div>
        </div>
    {:else if gameState.machineState === 'StockRound'}
        {#if session.stock.selectedSale}
            <div class="preview" aria-label="Confirm share sale">
                <h3>Share sale</h3>
                <ol>
                    {#each session.stock.selectedSale.sales as sale (sale.companyId)}
                        <li>
                            <strong>{getCompany(gameState, sale.companyId).name}</strong> · {sale.shares}
                            shares
                            <div class="buttons">
                                <button
                                    aria-label={`Remove ${sale.companyId} sale`}
                                    disabled={session.busy}
                                    onclick={() => session.stock.removeSale(sale.companyId)}
                                    >Remove</button
                                >
                            </div>
                        </li>
                    {/each}
                </ol>
                {#if session.stock.selectedSaleResult?.details}
                    {@const details = session.stock.selectedSaleResult.details}
                    <p>Total proceeds: <strong>{details.proceeds}</strong></p>
                    {#each details.sales as sale (sale.companyId)}
                        <p>
                            {getCompany(gameState, sale.companyId).name}: {sale.shares} × {sale.price}
                            = {sale.proceeds}. Market price: {sale.price} → {stockMarketSpace(
                                gameState.stockMarket,
                                sale.toMarketSpaceId
                            ).price}.
                        </p>
                        {#if sale.presidency}{@render presidency(sale.presidency)}{/if}
                    {/each}
                {:else}<p role="alert">{session.stock.selectedSaleResult?.reason}</p>{/if}
                <div class="buttons">
                    <button onclick={() => session.stock.cancel()} disabled={session.busy}
                        >Back</button
                    ><button
                        onclick={() => session.stock.confirmSale()}
                        disabled={session.busy || !session.stock.selectedSaleResult?.details}
                        >Confirm sale</button
                    >
                </div>
            </div>
        {/if}
        {#if !session.stock.hasSelection}<CompanyStarting {session} />{/if}
        <details open>
            <summary>Sell shares</summary>
            <div class="choices">
                {#each session.stock.saleChoices as choice (`${choice.request.seller.kind === 'company' ? choice.request.seller.companyId : choice.request.playerId}:${choice.sale.companyId}:${choice.sale.shares}`)}
                    <button
                        class="choice"
                        data-sale-company={choice.sale.companyId}
                        data-sale-shares={choice.sale.shares}
                        disabled={session.busy || !choice.result.details}
                        onclick={() => session.stock.selectSale(choice.request)}
                    >
                        <strong>{getCompany(gameState, choice.sale.companyId).name}</strong>
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
        {#if !session.stock.selectedSale && !gameState.stockRound.turn.bought}
            <details open>
                <summary>Buy shares</summary>
                <div class="choices">
                    {#each session.stock.purchaseChoices as choice (`${choice.request.buyer.kind === 'company' ? choice.request.buyer.companyId : choice.request.playerId}:${choice.certificate.id}`)}
                        <button
                            class="choice"
                            data-purchase-certificate={choice.certificate.id}
                            data-buyer={choice.request.buyer.kind === 'company'
                                ? choice.request.buyer.companyId
                                : 'player'}
                            disabled={session.busy || !choice.result.details}
                            onclick={() => session.stock.selectPurchase(choice.request)}
                        >
                            <strong
                                >{getCompany(gameState, choice.certificate.companyId).name}</strong
                            >
                            <span
                                >{session.ownerName(choice.request.buyer)} · {gameState.certificatePools.find(
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
    {#if session.stock.trades.length}
        <ol aria-label="Stock history">
            {#each session.stock.trades as trade (trade.id)}
                {#if isFinishStockTurn(trade) && trade.metadata}
                    <li>
                        {session.getPlayerName(trade.playerId)}
                        {trade.metadata.passed ? 'passed' : 'finished their turn'}.
                    </li>
                {:else if isCompleteStockRound(trade) && trade.metadata}
                    <li>
                        Stock round complete.
                        {#each trade.metadata.marketMoves as move}
                            <span
                                >{getCompany(gameState, move.companyId).name} sold out: {stockMarketSpace(
                                    gameState.stockMarket,
                                    move.fromMarketSpaceId
                                ).price} → {stockMarketSpace(
                                    gameState.stockMarket,
                                    move.toMarketSpaceId
                                ).price}.</span
                            >
                        {/each}
                    </li>
                {:else if isStartOperatingSet(trade) && trade.metadata}
                    <li>
                        Operating set {trade.metadata.number} started: {trade.metadata.roundCount}
                        {trade.metadata.roundCount === 1 ? 'round' : 'rounds'}.
                    </li>
                {:else if isStartCompany(trade) && trade.metadata}
                    <li>
                        {session.ownerName(trade.metadata.buyer)} started {getCompany(
                            gameState,
                            trade.companyId
                        ).name} at {trade.metadata.parPrice}, paying {trade.metadata.price} for the president’s
                        certificate.
                    </li>
                {:else if isFloatCompany(trade) && trade.metadata}
                    <li>
                        {getCompany(gameState, trade.companyId).name} floated.
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
                            gameState,
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
                                >{getCompany(gameState, sale.companyId).name}: {sale.shares} shares at
                                {sale.price}; market price {stockMarketSpace(
                                    gameState.stockMarket,
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
        background: var(--rail-surface, #fffefa);
        border: 1px solid var(--rail-border, #c9d2cb);
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
        border: 1px solid var(--rail-border, #aebfb4);
        background: var(--rail-surface, #edf3eb);
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
        border: 1px solid var(--rail-border, #b7c7b6);
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
