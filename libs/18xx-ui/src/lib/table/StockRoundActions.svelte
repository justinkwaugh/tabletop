<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getCompany, sameOwner, type Owner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    import CompanyDetails from './CompanyDetails.svelte'
    import type { CertificatePool } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session, trainColors, privateOperationDescription, poolName }: {
        session: FinanceExampleSession
        trainColors: Readonly<Record<string, string>>
        privateOperationDescription: (id: string, companyId: string) => string | undefined
        poolName?: (pool: CertificatePool) => string
    } = $props()
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
    const purchaseCompanies = $derived(session.stockCompanies.map((company) => company.id))
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
    {#if menu}
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
        {#if (menu === 'buy' && buyers.length > 1) || (menu === 'start' && startBuyers.length > 1)}
            <div class="heading owner-toggle" aria-label="Purchasing owner">
                {#each menu === 'buy' ? buyers : startBuyers as buyer, index}
                    {#if index > 0}<span class="separator" aria-hidden="true">/</span>{/if}
                    <button {disabled} aria-pressed={!!session.stockActionBuyer && sameOwner(buyer, session.stockActionBuyer)}
                        onclick={() => session.chooseStockMenu(menu, buyer)}>{buyer.kind === 'player' ? 'Yourself' : session.ownerName(buyer)}</button>
                {/each}
            </div>
        {/if}
        <div class="choices">
            {#if menu === 'start'}
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
                {#if session.selectedSaleCompany}
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
            {:else if menu === 'exchange'}
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
    <div class="choices purchase-cards">
                {#each purchaseCompanies as companyId (companyId)}
                    <CompanyDetails {session} company={getCompany(session.financialState, companyId)}
                        {trainColors} {privateOperationDescription} {poolName} vertical
                        displayName={session.stockCompanyName(companyId)}
                        unavailable={menu === 'buy' ? !buyerPurchases.some((choice) => choice.result.details?.companyId === companyId) : menu === 'sell' && !sales.some((choice) => choice.sale.companyId === companyId)}
                        canPurchase={(entry) => menu === 'buy' ? buyerPurchases.some((choice) => choice.certificate.companyId === companyId && choice.certificate.poolId === entry.poolId && sameOwner(choice.certificate.owner, entry.owner)) : menu === 'sell' && sales.some((choice) => choice.sale.companyId === companyId && sameOwner(choice.request.seller, entry.owner))}>
                        {#snippet purchaseSources(entry)}
                        <div class="purchase-options">
                        {#if menu === 'sell'}
                            <button class="purchase-option" {disabled} aria-label={`Sell ${getCompany(session.financialState, companyId).name}`}
                                onclick={() => session.chooseStockSaleCompany(companyId)}>
                                <span>{session.ownerName(entry.owner)}{#if getCompany(session.financialState, companyId).president && sameOwner(getCompany(session.financialState, companyId).president!, entry.owner)}<PresidentBadge />{/if}</span>
                                <span>{entry.shares}</span>
                            </button>
                        {:else}

                        {#each buyerPurchases.filter((choice) => choice.result.details?.companyId === companyId && choice.certificate.poolId === entry.poolId && sameOwner(choice.certificate.owner, entry.owner)) as choice (choice.certificate.id)}
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
                                <span class="purchase-amount">{entry.shares}</span>
                            </button>
                            {/if}
                        {/each}
                        {/if}
                        </div>
                        {/snippet}
                    </CompanyDetails>
                {/each}

    </div>
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
    .purchase-options { padding: 0; }
    .purchase-amount { font-variant-numeric: tabular-nums; }
    button.purchase-option {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0;
        line-height: 17px;
        color: #514538;
        border: 0;
        border-radius: 0;
        background: transparent;
        text-align: left;
    }
    .purchase-source { font-size: 12px; }
    .purchase-option small { margin-top: 1px; }

    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 8px;
    }
    .choices.purchase-cards {
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow-x: auto;
        min-width: 0;
        padding-bottom: 4px;
    }
    .purchase-cards :global(.company-detail) { flex: 0 0 200px; }
    .purchase-cards :global(.company-detail:first-child) { margin-left: auto; }
    .purchase-cards :global(.company-detail:last-child) { margin-right: auto; }
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
    button[aria-pressed='true'] {
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
    .owner-toggle { gap: 7px; min-height: 22px; }
    .owner-toggle button,
    .owner-toggle button:hover:not(:disabled),
    .owner-toggle button[aria-pressed='true'] {
        border: 0;
        padding: 2px 0;
        background: transparent;
        box-shadow: none;
        color: #786550;
        font-size: 13px;
    }
    .owner-toggle button[aria-pressed='true'] { color: #443c34; font-weight: 700; }
    .owner-toggle button:hover:not(:disabled) { color: #443c34; }
    .owner-toggle .separator { color: #a08d7a; }
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
