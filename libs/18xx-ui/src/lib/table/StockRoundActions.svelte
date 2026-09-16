<script lang="ts">
    import { marketColors } from '../stock/marketColors.js'
    import { assertExists } from '@tabletop/common'
    import { cashOwnedBy, getCompany, sharesOwned, companyMarketSpace, stockMarketSpace, sameOwner, type Owner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import { companyOwnership } from '../finance/companyOwnership.js'
    import type { CertificatePool } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session, poolName }: {
        session: FinanceExampleSession
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
    const purchaseCompanies = $derived(session.stockCompanies.filter((company) =>
        buyerPurchases.some((choice) => choice.certificate.companyId === company.id)))
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
    function buyerCash(buyer: Owner): string {
        const cash = cashOwnedBy(session.financialState, buyer)
        assertExists(cash, 'A stock buyer company requires a cash account')
        return cash.toLocaleString('en-US')
    }
</script>

{#snippet token(companyId: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={38} />
{/snippet}
<section aria-label="Stock trading">
    {#if session.mustSell}<p class="notice">Sell down to the stock limits.</p>{/if}
    {#if menu}
        <div class="heading available-shares">
            <span
                >{menu === 'buy'
                    ? (session.stockActionBuyer?.kind === 'company' ? `Buy for ${session.ownerName(session.stockActionBuyer)}` : 'Available Shares')
                    : menu === 'sell'
                      ? 'Available Sales'
                      : menu === 'start'
                        ? 'Available Companies'
                        : 'Available Exchanges'}</span
            >
        </div>
        {#if (menu === 'buy' && buyers.length > 1) || (menu === 'start' && startBuyers.length > 1)}
            <div class="heading owner-toggle" aria-label="Purchasing owner">
                {#each menu === 'buy' ? buyers : startBuyers as buyer, index}
                    {#if index > 0}<span class="separator" aria-hidden="true"></span>{/if}
                    <button {disabled} aria-pressed={!!session.stockActionBuyer && sameOwner(buyer, session.stockActionBuyer)}
                        onclick={() => session.chooseStockMenu(menu, buyer)}>{buyer.kind === 'player' ? 'Yourself' : session.ownerName(buyer)}{#if buyer.kind === 'company'} <span class="owner-cash">${buyerCash(buyer)}</span>{/if}</button>
                {/each}
            </div>
        {/if}
        <div class="choices" class:exchange-list={menu === 'exchange'}>
            {#if menu === 'buy'}
                {#each purchaseCompanies as company (company.id)}
                    {@const ownership = companyOwnership(session.financialState, company.id)}
                    {@const options = buyerPurchases.filter((choice) => choice.certificate.companyId === company.id)}
                    {@const prices = [...new Set(options.map((choice) => choice.result.details?.price))]}
                    {@const toFloat = company.floated ? undefined : session.sharesToFloat(company.id)}
                    <div class="share-pill" aria-label={company.name}>
                        <div class="share-identity">
                            <CompanyToken appearance={session.mapView.stations[company.id]} size={30} />
                            <span class="share-value">{prices.map((price) => `$${price}`).join(' / ')}</span>
                        </div>
                        {#if toFloat !== undefined && toFloat > 0}
                            <div class="float-band">{toFloat} to float</div>
                        {/if}
                        <div class="share-sources">
                            {#each options as choice (choice.certificate.id)}
                                {#if choice.certificate.kind === 'share'}
                                {@const pool = session.financialState.certificatePools.find((pool) => pool.id === choice.certificate.poolId)}
                                {@const source = pool ? (poolName?.(pool) ?? pool.name).replace('Treasury shares', 'Treasury') : session.ownerName(choice.certificate.owner)}
                                {@const count = ownership.find((entry) => entry.poolId === choice.certificate.poolId && sameOwner(entry.owner, choice.certificate.owner))?.shares}
                                <button class="share-source" {disabled}
                                    aria-label={`Buy ${company.name} from ${source} for $${choice.result.details?.price}`}
                                    data-purchase-certificate={choice.certificate.id}
                                    onclick={() => { session.selectPurchase(choice.request); void session.confirmPurchase() }}>
                                    <span class="source-label">{source}
                                        {#if choice.certificate.number !== undefined}<small>Share #{choice.certificate.number}</small>{/if}
                                        {#if choice.certificate.president || choice.certificate.shares !== 1}<small>{choice.certificate.shares} shares{choice.certificate.president ? ' · President' : ''}</small>{/if}
                                    </span>
                                    <span class="share-count">{count}</span>
                                    {#if prices.length > 1}<small>${choice.result.details?.price}</small>{/if}
                                </button>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/each}
            {:else if menu === 'start'}
                <div class="start-selection">
                    <div class="choices start-choices">
                        {#each buyerStarts as choice}
                            <button class="company-choice start-company-choice"
                                {disabled}
                                aria-label={`Start ${getCompany(session.financialState, choice.request.companyId).name}`}
                                aria-pressed={session.selectedStartCompany?.companyId === choice.request.companyId}
                                data-start-company={choice.request.companyId}
                                onclick={() => session.selectCompanyStart(choice.request)}>
                                {@render token(choice.request.companyId)}
                            </button>
                        {/each}
                    </div>
                    {#if session.selectedStartCompany}
                        {@const sharesToFloat = session.sharesToFloat(session.selectedStartCompany.companyId)}
                        <div class="choices par-choices">
                            {#each session.selectedStartPrices as price}
                                {#if price.result.details}
                                     {@const space = stockMarketSpace(session.financialState.stockMarket, price.marketSpaceId)}
                                    <button class="par-choice" {disabled}
                                        style:background={marketColors[space.color] ?? space.color}
                                        data-start-price={price.result.details.parPrice}
                                        onclick={() => {
                                            session.selectStartPrice(price.marketSpaceId)
                                            void session.confirmStart()
                                        }}>
                                        <span class="par-value">{price.result.details.parPrice}</span>
                                        <small>Cost ${price.result.details.price}</small>
                                        {#if sharesToFloat !== undefined}
                                            <small class="float-cost">${(sharesToFloat * price.result.details.parPrice).toLocaleString('en-US')} to float</small>
                                        {/if}
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else if menu === 'sell'}
                <div class="start-selection">
                    <div class="choices">
                        {#each session.stockCompanies.filter((company) => sales.some((choice) => choice.sale.companyId === company.id)) as company (company.id)}
                            <button class="share-identity sale-company" {disabled}
                                aria-label={`Sell ${company.name}`}
                                aria-pressed={session.selectedSaleCompany === company.id}
                                data-sale-company={company.id}
                                onclick={() => {
                                    session.cancelSelection()
                                    session.chooseStockSaleCompany(company.id)
                                }}>
                                <CompanyToken appearance={session.mapView.stations[company.id]} size={30} />
                                <span class="sale-heading-values"><span class="share-value">${session.financialState.stockRound.turn.saleBlocks?.find((block) => block.companyId === company.id && block.seller.kind === 'player' && block.seller.playerId === session.myPlayer?.id)?.price ?? companyMarketSpace(session.financialState.stockMarket, company.id).price}</span>
                                    {#if session.myPlayer}<small>{sharesOwned(session.financialState, company.id, { kind: 'player', playerId: session.myPlayer.id })} owned</small>{/if}</span>
                            </button>
                        {/each}
                    </div>
                    {#if session.selectedSaleCompany}
                        <div class="choices">
                            {#each sales.filter((choice) => choice.sale.companyId === session.selectedSaleCompany) as choice}
                                <button class="sale-quantity" {disabled}
                                    data-sale-shares={choice.sale.shares}
                                    aria-label={`Sell ${choice.sale.shares} shares for $${choice.result.details?.proceeds}`}
                                    aria-pressed={!!session.selectedSale && sameOwner(session.selectedSale.seller, choice.request.seller) && session.selectedSale.sales.some((sale) => sale.companyId === choice.sale.companyId && sale.shares === choice.sale.shares)}
                                    onclick={() => {
                                        if (session.stockSaleSelection?.source !== 'auto') session.selectSale(choice.request)
                                    }}>
                                    <span class="share-count">{choice.sale.shares}</span>
                                    <small>${choice.result.details?.proceeds}</small>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
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
                        ? `Sell ${session.selectedSaleResult.details.sales.reduce((total, sale) => total + sale.shares, 0)} for $${session.selectedSaleResult.details.proceeds}`
                        : 'Sell'}</button
                >
                {#if session.selectedSaleResult?.reason}<p role="alert">
                        {session.selectedSaleResult.reason}
                    </p>{/if}
            </div>
        {/if}
    {:else}
        <div class="heading available-shares idle-prompt">Choose an action above</div>
    {/if}

</section>

<style>
    section {
        padding: 4px 0;
    }
    .choices.exchange-list { flex-direction: column; align-items: stretch; width: fit-content; max-width: 100%; margin-inline: auto; gap: 4px; }
    button.exchange-choice { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border: 0; background: #eee6da; text-align: left; }
    button.exchange-choice:hover:not(:disabled) { background: #dfd1be; color: #352b21; }
    .exchange-private { flex: 1; font-weight: 400; }
    .exchange-arrow { color: #95816a; font-size: 16px; }
    .exchange-company { display: flex; align-items: center; flex-shrink: 0; }
    .share-pill { border: 1px solid #c7b8a6; border-radius: 6px; display: flex; flex-direction: column; gap: 0; padding: 0; overflow: hidden; background: transparent; }
    .share-identity { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; padding: 4px 8px; align-self: stretch; background: #f3ede4; }
    .share-identity :global(svg) { flex-shrink: 0; }
    .float-band { padding: 3px 6px; background: #493b2b; color: #fff8e9; font-size: 10px; line-height: 12px; text-align: center; }
    .share-sources { display: flex; align-self: stretch; }
    button.share-source { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 3px 7px; border: 0; border-radius: 0; background: transparent; text-align: center; }
    .share-source + .share-source::before { content: ""; position: absolute; left: 0; top: 7px; bottom: 7px; border-left: 1px solid #d8cbbc; }
    .source-label { font-size: 9px; line-height: 11px; text-transform: uppercase; letter-spacing: .035em; color: #786550; }
    .share-count { font-size: 18px; line-height: 20px; font-variant-numeric: tabular-nums; }
    .sale-heading-values { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    button.sale-quantity { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 10px; }
    button.sale-company[aria-pressed='true'] { background: #e5d7c3; }
    button.sale-quantity[aria-pressed='true'] { background: #e5d7c3; box-shadow: none; }

    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
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
    .start-selection { display: flex; flex-direction: column; gap: 8px; }
    .choices.start-choices { gap: 3px; }
    button.start-company-choice[aria-pressed='true'] { background: #e5d7c3; box-shadow: none; }
    button.par-choice { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 10px; border-color: #00000026; }
    .par-choice small { color: #39352f; }
    .par-choice .float-cost { font-weight: 700; }
    button.par-choice:hover:not(:disabled) { filter: brightness(.95); }
    .par-value { font-size: 24px; line-height: 26px; font-variant-numeric: tabular-nums; }
    button.start-company-choice { min-width: 0; padding: 4px; border-color: transparent; background: transparent; }
    button.start-company-choice:hover:not(:disabled) { background: #efe7db; }
    small {
        display: block;
        font-size: 10px;
        color: #786550;
    }
    .heading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
        font-size: 13px;
    }
    .heading.available-shares { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #63513e; }
    .heading.idle-prompt { margin-bottom: 0; }
    .owner-cash { margin-left: 5px; font-variant-numeric: tabular-nums; }
    .owner-toggle { gap: 7px; min-height: 22px; }
    .owner-toggle button,
    .owner-toggle button:hover:not(:disabled),
    .owner-toggle button[aria-pressed='true'] {
        border: 0;
        padding: 3px 8px;
        background: transparent;
        box-shadow: none;
        color: #786550;
        font-size: 13px;
    }
    .owner-toggle button[aria-pressed='true'],
    .owner-toggle button[aria-pressed='true']:hover:not(:disabled) { color: #443c34; font-weight: 700; background: #e5d7c3; }
    .owner-toggle button:hover:not(:disabled) { color: #443c34; }
    .owner-toggle .separator { height: 13px; border-left: 1px solid #b7a58f; }
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
