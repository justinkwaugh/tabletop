<script lang="ts">
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import { getCompany } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session, additionalActions = [] }: { session: FinanceExampleSession; additionalActions?: readonly StockMenuOption[] } = $props()
    const disabled = $derived(
        session.busy ||
            session.updatingVisibleState ||
            session.isViewingHistory ||
            !session.myPlayer ||
            !session.financialState.activePlayerIds.includes(session.myPlayer.id)
    )
    const purchases = $derived.by(() => {
        const seen = new Set<string>()
        return session.purchaseChoices.filter((choice) => {
            if (!choice.result.details || choice.certificate.kind !== 'share') return false
            const key = JSON.stringify([
                choice.request.buyer,
                choice.certificate.companyId,
                choice.certificate.poolId,
                choice.certificate.number,
                choice.certificate.shares,
                choice.certificate.president,
                choice.result.details.price
            ])
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    })
    const sales = $derived(session.saleChoices.filter((choice) => choice.result.details))
    const starts = $derived(
        session.startChoices.filter((choice) => choice.prices.some((price) => price.result.details))
    )
    const menu = $derived(session.stockMenu)
    function back() {
        if (session.selectedStartCompany) session.backFromStart()
        else if (session.selectedSale) session.cancelSelection()
        else session.backFromStockMenu()
    }
</script>

{#snippet token(companyId: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={38} />
{/snippet}
<section aria-label="Stock trading">
    {#if session.mustSell}<p class="notice">Sell down to the stock limits.</p>{/if}
    {#if !menu}
        <div class="choices">
            {#if purchases.length}<button {disabled} onclick={() => session.chooseStockMenu('buy')}
                    >Buy</button
                >{/if}
            {#if sales.length}<button {disabled} onclick={() => session.chooseStockMenu('sell')}
                    >Sell</button
                >{/if}
            {#if starts.length}<button {disabled} onclick={() => session.chooseStockMenu('start')}
                    >Start</button
                >{/if}
            {#if session.privateExchangeOffers.length}<button
                    {disabled}
                    onclick={() => session.chooseStockMenu('exchange')}>Exchange</button
                >{/if}
            {#each additionalActions as action}<button {disabled} onclick={action.onSelect}>{action.label}</button>{/each}
            {#if session.validActionTypes.includes('FinishStockTurn')}<button
                    {disabled}
                    onclick={() => session.finishTurn()}
                    >{session.financialState.stockRound.turn.acted ? 'Finish turn' : 'Pass'}</button
                >{/if}
        </div>
    {:else}
        <div class="heading">
            <button class="back" {disabled} onclick={back}>Back</button><span
                >{menu === 'buy'
                    ? 'Buy shares'
                    : menu === 'sell'
                      ? 'Sell shares'
                      : menu === 'start'
                        ? 'Start a company'
                        : 'Exchange a private'}</span
            >
        </div>
        <div class="choices">
            {#if menu === 'buy'}
                {#each purchases as choice}
                    {@const details = choice.result.details}
                    {#if details}
                        <button
                            class="company-choice"
                            {disabled}
                            aria-label={`Buy ${getCompany(session.financialState, details.companyId).name} for $${details.price}`}
                            data-purchase-certificate={choice.certificate.id}
                            onclick={() => {
                                session.selectPurchase(choice.request)
                                void session.confirmPurchase()
                            }}
                        >
                            {@render token(details.companyId)}
                            <strong>${details.price}</strong>
                            {#if choice.certificate.kind === 'share' && choice.certificate.number !== undefined}<small
                                    >#{choice.certificate.number}</small
                                >{/if}
                            <small
                                >{session.financialState.certificatePools.find(
                                    (pool) => pool.id === choice.certificate.poolId
                                )?.name}</small
                            >
                            {#if choice.request.buyer.kind === 'company'}<small
                                    >{session.ownerName(choice.request.buyer)}</small
                                >{/if}
                        </button>
                    {/if}
                {/each}
            {:else if menu === 'start'}
                {#if session.selectedStartCompany}
                    {#each session.selectedStartPrices as price}
                        {#if price.result.details}<button
                                {disabled}
                                data-start-price={price.result.details.parPrice}
                                onclick={() => {
                                    session.selectStartPrice(price.marketSpaceId)
                                    void session.confirmStart()
                                }}
                            >
                                {price.result.details.parPrice}<small
                                    >Pay ${price.result.details.price}</small
                                >
                            </button>{/if}
                    {/each}
                {:else}
                    {#each starts as choice}<button
                            class="company-choice"
                            {disabled}
                            aria-label={`Start ${getCompany(session.financialState, choice.request.companyId).name}`}
                            data-start-company={choice.request.companyId}
                            onclick={() => session.selectCompanyStart(choice.request)}
                        >
                            {@render token(choice.request.companyId)}
                            {#if choice.request.buyer.kind === 'company'}<small
                                    >{session.ownerName(choice.request.buyer)}</small
                                >{/if}
                        </button>{/each}
                {/if}
            {:else if menu === 'sell'}
                {#if !session.selectedSaleCompany}
                    {#each [...new Set(sales.map((choice) => choice.sale.companyId))] as companyId}
                        <button
                            class="company-choice"
                            {disabled}
                            aria-label={`Sell ${getCompany(session.financialState, companyId).name}`}
                            onclick={() => session.chooseStockSaleCompany(companyId)}
                            >{@render token(companyId)}</button
                        >
                    {/each}
                {:else}
                    {#each sales.filter((choice) => choice.sale.companyId === session.selectedSaleCompany) as choice}<button
                            class="company-choice"
                            {disabled}
                            data-sale-company={choice.sale.companyId}
                            data-sale-shares={choice.sale.shares}
                            onclick={() => session.selectSale(choice.request)}
                        >
                            {@render token(choice.sale.companyId)}
                            <span
                                >{choice.sale.shares}
                                {choice.sale.shares === 1 ? 'share' : 'shares'}</span
                            ><strong>${choice.result.details?.proceeds}</strong>
                            {#if choice.request.seller.kind === 'company'}<small
                                    >{session.ownerName(choice.request.seller)}</small
                                >{/if}
                        </button>{/each}
                {/if}
            {:else}
                {#each session.privateExchangeOffers as offer}<button
                        {disabled}
                        onclick={() => {
                            session.selectPrivateExchange(offer)
                            void session.confirmPrivateExchange()
                        }}
                    >
                        {getCompany(session.financialState, offer.privateCompanyId).name}<small
                            >{offer.certificateId}</small
                        >
                    </button>{/each}
            {/if}
        </div>
        {#if menu === 'sell' && session.selectedSale}
            <div class="sale-order">
                {#if session.selectedSaleCompany}<button
                        {disabled}
                        onclick={() => session.backFromStockMenu()}>Add another company</button
                    >{/if}
                {#each session.selectedSale.sales as sale, index}<div class="sale">
                        <span
                            >{getCompany(session.financialState, sale.companyId).name} · {sale.shares}</span
                        >
                        <button
                            aria-label={`Move ${sale.companyId} earlier`}
                            disabled={disabled || index === 0}
                            onclick={() => session.moveSale(sale.companyId, -1)}>↑</button
                        >
                        <button
                            aria-label={`Move ${sale.companyId} later`}
                            disabled={disabled || index === session.selectedSale.sales.length - 1}
                            onclick={() => session.moveSale(sale.companyId, 1)}>↓</button
                        >
                        <button
                            aria-label={`Remove ${sale.companyId} sale`}
                            {disabled}
                            onclick={() => session.removeSale(sale.companyId)}>×</button
                        >
                    </div>{/each}
                <button
                    class="confirm"
                    disabled={disabled || !session.selectedSaleResult?.details}
                    onclick={() => session.confirmSale()}
                    >{session.selectedSaleResult?.details
                        ? `Sell for $${session.selectedSaleResult.details.proceeds}`
                        : 'Sell'}</button
                >
                {#if session.selectedSaleResult?.reason}<p role="alert">
                        {session.selectedSaleResult.reason}
                    </p>{/if}
            </div>
        {/if}
    {/if}
</section>

<style>
    section {
        padding: 4px 0;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        justify-content: center;
        gap: 8px;
    }
    button {
        border: 1px solid #c7b8a6;
        border-radius: 6px;
        padding: 7px 14px;
        background: #fffdf8;
        color: #514536;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: #efe7db;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .company-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 66px;
        padding: 7px 9px;
    }
    small {
        display: block;
        font-size: 10px;
        color: #786550;
    }
    strong {
        font-size: 12px;
        font-weight: 600;
    }
    .heading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
        font-size: 13px;
    }
    .back {
        padding: 4px 10px;
        background: transparent;
    }
    .notice {
        text-align: center;
        font-size: 12px;
        margin: 0 0 8px;
    }
    .sale-order {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin-top: 12px;
        font-size: 12px;
    }
    .sale {
        display: flex;
        gap: 5px;
        align-items: center;
    }
    .sale button {
        padding: 2px 7px;
    }
    .confirm {
        margin-top: 5px;
        background: #695540;
        color: #fffaf4;
    }
</style>
