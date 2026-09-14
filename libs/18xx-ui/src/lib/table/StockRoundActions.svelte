<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import { getCompany, sameOwner, type Owner } from '@tabletop/18xx'
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
    function distinctBuyers(owners: readonly Owner[]): Owner[] {
        return owners.filter((owner, index) =>
            owners.findIndex((candidate) => sameOwner(candidate, owner)) === index)
    }
    const buyers = $derived(distinctBuyers(purchases.map((choice) => choice.request.buyer)))
    const buyerPurchases = $derived(purchases.filter((choice) =>
        session.stockActionBuyer
            ? sameOwner(choice.request.buyer, session.stockActionBuyer)
            : choice.request.buyer.kind === 'player'))
    const purchaseCompanies = $derived([...new Set(buyerPurchases.map((choice) => choice.result.details!.companyId))])
    const sales = $derived(session.saleChoices.filter((choice) => choice.result.details))
    const starts = $derived(
        session.startChoices.filter((choice) => choice.prices.some((price) => price.result.details))
    )
    const startBuyers = $derived(distinctBuyers(starts.map((choice) => choice.request.buyer)))
    const buyerStarts = $derived(starts.filter((choice) =>
        session.stockActionBuyer
            ? sameOwner(choice.request.buyer, session.stockActionBuyer)
            : choice.request.buyer.kind === 'player'))
    const menu = $derived(session.stockMenu)

    function exchangeCompany(certificateId: string) {
        const certificate = session.financialState.certificates.find((item) => item.id === certificateId)
        assertExists(certificate, 'An exchange requires its destination certificate')
        return getCompany(session.financialState, certificate.companyId)
    }
</script>

{#snippet token(companyId: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={38} />
{/snippet}
<section aria-label="Stock trading">
    {#if session.mustSell}<p class="notice">Sell down to the stock limits.</p>{/if}
    {#if !menu}
        <header class="heading stock-prompt">
            <span>Choose a stock action{session.validActionTypes.includes('FinishStockTurn') ? ' or' : ''}</span>
            {#if session.validActionTypes.includes('FinishStockTurn')}
                <button class="action-button inline-action" {disabled} onclick={() => session.finishTurn()}
                    >{session.financialState.stockRound.turn.acted ? 'end turn' : 'pass'}</button>
            {/if}
        </header>
        <div class="choices">
            {#each buyers as buyer}<button class="buy-action" {disabled} onclick={() => session.chooseStockMenu('buy', buyer)}
                >{buyer.kind === 'player' ? 'Buy' : `Buy for ${session.ownerName(buyer)}`}</button>{/each}
            {#if sales.length}<button {disabled} onclick={() => session.chooseStockMenu('sell')}
                    >Sell</button
                >{/if}
            {#each startBuyers as buyer}<button {disabled} onclick={() => session.chooseStockMenu('start', buyer)}
                    >{buyer.kind === 'player' ? 'Start' : `Start for ${session.ownerName(buyer)}`}</button
                >{/each}
            {#if session.privateExchangeOffers.length}<button
                    {disabled}
                    onclick={() => session.chooseStockMenu('exchange')}>Exchange</button
                >{/if}
            {#each additionalActions as action}<button {disabled} onclick={action.onSelect}>{action.label}</button>{/each}
        </div>
    {:else}
        <div class="heading">
            <span
                >{menu === 'buy'
                    ? (session.stockActionBuyer?.kind === 'company' ? `Buy for ${session.ownerName(session.stockActionBuyer)}` : 'Choose a share')
                    : menu === 'sell'
                      ? 'Sell shares'
                      : menu === 'start'
                        ? (session.stockActionBuyer?.kind === 'company' ? `Start for ${session.ownerName(session.stockActionBuyer)}` : 'Start a company')
                        : 'Exchange a private'}</span
            >
        </div>
        <div class="choices">
            {#if menu === 'buy'}
                {#each purchaseCompanies as companyId (companyId)}
                    <article class="purchase-card" aria-label={`${getCompany(session.financialState, companyId).name} shares`}>
                        <header><CompanyToken appearance={session.mapView.stations[companyId]} size={30} />
                            <strong>{getCompany(session.financialState, companyId).name}</strong></header>
                        <div class="purchase-options">
                        {#each buyerPurchases.filter((choice) => choice.result.details?.companyId === companyId) as choice (choice.certificate.id)}
                            {@const details = choice.result.details}
                            {#if details && choice.certificate.kind === 'share'}
                            {@const pool = session.financialState.certificatePools.find((pool) => pool.id === choice.certificate.poolId)}
                            {@const sourceName = pool?.name === 'Treasury shares' ? 'Treasury' : pool?.name}
                            <button class="purchase-option" {disabled}
                                aria-label={`Buy ${getCompany(session.financialState, companyId).name} from ${sourceName} for $${details.price}`}
                                data-purchase-certificate={choice.certificate.id}
                                onclick={() => { session.selectPurchase(choice.request); void session.confirmPurchase() }}>
                                <span class="purchase-source">{sourceName}
                                    {#if choice.certificate.number !== undefined}<small>Share #{choice.certificate.number}</small>{/if}
                                    {#if choice.certificate.president || choice.certificate.shares !== 1}<small>{choice.certificate.shares} shares{choice.certificate.president ? ' · President' : ''}</small>{/if}
                                </span>
                                <strong>${details.price.toLocaleString('en-US')}</strong>
                            </button>
                            {/if}
                        {/each}
                        </div>
                    </article>
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
                    {#each buyerStarts as choice}<button
                            class="company-choice"
                            {disabled}
                            aria-label={`Start ${getCompany(session.financialState, choice.request.companyId).name}`}
                            data-start-company={choice.request.companyId}
                            onclick={() => session.selectCompanyStart(choice.request)}
                        >
                            {@render token(choice.request.companyId)}
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
                            aria-pressed={!!session.selectedSale && sameOwner(session.selectedSale.seller, choice.request.seller) && session.selectedSale.sales.some((sale) => sale.companyId === choice.sale.companyId && sale.shares === choice.sale.shares)}
                            onclick={() => {
                                if (session.stockSaleSelection?.source !== 'auto') session.selectSale(choice.request)
                            }}
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
                {#each session.privateExchangeOffers as offer}
                    {@const company = exchangeCompany(offer.certificateId)}
                    <button class="exchange-choice"
                        aria-label={`Exchange ${getCompany(session.financialState, offer.privateCompanyId).name} for ${company.name}`}
                        {disabled}
                        onclick={() => {
                            session.selectPrivateExchange(offer)
                            void session.confirmPrivateExchange()
                        }}
                    >
                        <span class="exchange-private">{getCompany(session.financialState, offer.privateCompanyId).name}</span>
                        <span class="exchange-arrow" aria-hidden="true">→</span>
                        <span class="exchange-company">
                            <CompanyToken appearance={session.mapView.stations[company.id]} size={28} />
                            <span>{company.name}</span>
                        </span>
                    </button>{/each}
            {/if}
        </div>
        {#if menu === 'sell' && session.selectedSale}
            <div class="sale-order">
                <button
                    class="confirm action-button"
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
    button.exchange-choice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
    }
    .exchange-private { font-weight: 600; }
    .exchange-arrow { color: #95816a; font-size: 20px; }
    .exchange-company {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 4px 9px 4px 4px;
        border: 1px solid #c9baa6;
        border-radius: 20px;
        background: #ece3d7;
        text-align: left;
    }
    .exchange-company span { max-width: 180px; line-height: 1.25; }
    .purchase-card {
        flex: 0 1 210px;
        min-width: 170px;
        align-self: flex-start;
        overflow: hidden;
        border: 1px solid #c5b8a6;
        border-radius: 7px;
        background: #fffdf8;
        box-shadow: 0 1px 2px #5145360d;
    }
    .purchase-card header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        background: #e5dccf;
        color: #42382d;
    }
    .purchase-card header strong { font-size: 13px; line-height: 1.25; }
    .purchase-options { padding: 3px 0; }
    button.purchase-option {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 11px;
        border: 0;
        border-radius: 0;
        background: transparent;
        text-align: left;
    }
    .purchase-option + .purchase-option { border-top: 1px solid #e9e1d6; }
    .purchase-option strong { font-size: 13px; font-variant-numeric: tabular-nums; }
    .purchase-source { font-size: 12px; }
    .purchase-option small { margin-top: 1px; }

    .heading.stock-prompt { gap: 5px; }
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
    .company-choice[aria-pressed='true'] {
        border-color: #8c7050;
        background: #e5d7c3;
        box-shadow: inset 0 0 0 1px #8c7050;
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
    .confirm {
        margin-top: 5px;
        background: #695540;
        color: #fffaf4;
    }
</style>
