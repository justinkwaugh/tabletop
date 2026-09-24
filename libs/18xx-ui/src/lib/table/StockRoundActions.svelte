<script lang="ts">
    import { cashText, optionalMoney } from '../presentation/money.js'
    import { marketColors } from '../stock/marketColors.js'
    import { assertExists } from '@tabletop/common'
    import {
        cashOwnedBy,
        getCompany,
        sharesOwned,
        companyMarketSpace,
        stockMarketSpace,
        sameOwner,
        type Owner
    } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { companyOwnership } from '../finance/companyOwnership.js'
    import { playerPurchaseContribution } from '../stock/purchaseContribution.js'
    import type { CertificatePool } from '@tabletop/18xx'
    import SlidingToggle from './SlidingToggle.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import StandingInstruction from '../stock/StandingInstruction.svelte'
    let {
        session,
        poolName
    }: {
        session: EighteenXXSession
        poolName?: (pool: CertificatePool) => string
    } = $props()
    const money = $derived(session.presentation.money)
    const disabled = $derived(
        session.busy ||
            session.updatingVisibleState ||
            session.isViewingHistory ||
            !session.myPlayer ||
            !session.gameState.activePlayerIds.includes(session.myPlayer.id)
    )
    const purchases = $derived.by(() => {
        const seen = new Set<string>()
        return session.stock.purchaseChoices.filter((choice) => {
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
        return owners.filter(
            (owner, index) => owners.findIndex((candidate) => sameOwner(candidate, owner)) === index
        )
    }
    const buyers = $derived(distinctBuyers(purchases.map((choice) => choice.request.buyer)))
    const buyerPurchases = $derived(
        purchases.filter((choice) =>
            session.stock.menuBuyer
                ? sameOwner(choice.request.buyer, session.stock.menuBuyer)
                : choice.request.buyer.kind === 'player'
        )
    )
    const purchaseCompanies = $derived(
        session.stockCompanies.filter((company) =>
            buyerPurchases.some((choice) => choice.certificate.companyId === company.id)
        )
    )
    const sales = $derived(session.stock.saleChoices.filter((choice) => choice.result.details))
    const starts = $derived(
        session.stock.startChoices.filter((choice) =>
            choice.prices.some((price) => price.result.details)
        )
    )
    const startBuyers = $derived(distinctBuyers(starts.map((choice) => choice.request.buyer)))
    const buyerStarts = $derived(
        starts.filter((choice) =>
            session.stock.menuBuyer
                ? sameOwner(choice.request.buyer, session.stock.menuBuyer)
                : choice.request.buyer.kind === 'player'
        )
    )
    const menu = $derived(session.stock.openMenu)
    const purchasingOwners = $derived(menu === 'buy' ? buyers : startBuyers)
    const selectedOwnerIndex = $derived(
        purchasingOwners.findIndex((buyer) =>
            session.stock.menuBuyer
                ? sameOwner(buyer, session.stock.menuBuyer)
                : buyer.kind === 'player'
        )
    )

    function exchangeCompany(certificateId: string) {
        const certificate = session.gameState.certificates.find((item) => item.id === certificateId)
        assertExists(certificate, 'An exchange requires its destination certificate')
        return getCompany(session.gameState, certificate.companyId)
    }
    function buyerCash(buyer: Owner): string {
        const cash = cashOwnedBy(session.gameState, buyer)
        assertExists(cash, 'A stock buyer company requires a cash account')
        return cashText(money, cash)
    }
</script>

{#snippet token(companyId: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={38} />
{/snippet}
<section class="stock-trading centered-panel" aria-label="Stock trading">
    <div class="stock-controls">
        {#if session.stock.mustSell}<p class="notice">Sell down to the stock limits.</p>{/if}
        {#if menu}
            <div class="heading available-shares">
                <span
                    >{menu === 'buy'
                        ? session.stock.menuBuyer?.kind === 'company'
                            ? `Buy for ${session.ownerName(session.stock.menuBuyer)}`
                            : 'Available Shares'
                        : menu === 'sell'
                          ? 'Available Sales'
                          : menu === 'start'
                            ? 'Available Companies'
                            : 'Available Exchanges'}</span
                >
            </div>
            {#if (menu === 'buy' && buyers.length > 1) || (menu === 'start' && startBuyers.length > 1)}
                <div class="heading owner-toggle" role="group" aria-label="Purchasing owner">
                    <SlidingToggle
                        count={purchasingOwners.length}
                        selectedIndex={selectedOwnerIndex}
                    >
                        {#each purchasingOwners as buyer, index (index)}
                            <button
                                {disabled}
                                aria-pressed={index === selectedOwnerIndex}
                                onclick={() => session.stock.chooseMenu(menu, buyer)}
                                >{buyer.kind === 'player'
                                    ? 'Yourself'
                                    : session.ownerName(buyer)}{#if buyer.kind === 'company'}
                                    <span class="owner-cash">{buyerCash(buyer)}</span>{/if}</button
                            >
                        {/each}
                    </SlidingToggle>
                </div>
            {/if}
            <div
                class="choices"
                class:buy-choices={menu === 'buy'}
                class:exchange-list={menu === 'exchange'}
            >
                {#if menu === 'buy'}
                    {#each purchaseCompanies as company (company.id)}
                        {@const ownership = companyOwnership(session.gameState, company.id)}
                        {@const options = buyerPurchases.filter(
                            (choice) => choice.certificate.companyId === company.id
                        )}
                        {@const prices = [
                            ...new Set(options.map((choice) => choice.result.details?.price))
                        ]}
                        {@const toFloat = company.floated
                            ? undefined
                            : session.sharesToFloat(company.id)}
                        {@const playerPayments =
                            session.stock.menuBuyer?.kind === 'company'
                                ? [
                                      ...new Set(
                                          options.flatMap((choice) =>
                                              choice.result.details
                                                  ? [
                                                        playerPurchaseContribution(
                                                            choice.result.details,
                                                            session.myPlayer?.id
                                                        )
                                                    ]
                                                  : []
                                          )
                                      )
                                  ]
                                : []}
                        <div class="share-offer">
                            <div class="share-pill" aria-label={company.name}>
                                <div class="share-identity">
                                    <CompanyToken
                                        appearance={session.mapView.stations[company.id]}
                                        size={30}
                                    />
                                    <span class="share-value"
                                        >{prices
                                            .map((price) => optionalMoney(money, price))
                                            .join(' / ')}</span
                                    >
                                </div>
                                {#if toFloat !== undefined && toFloat > 0}
                                    <div class="float-band">{toFloat} to float</div>
                                {/if}
                                <div class="share-sources">
                                    {#each options as choice (choice.certificate.id)}
                                        {#if choice.certificate.kind === 'share'}
                                            {@const pool = session.gameState.certificatePools.find(
                                                (pool) => pool.id === choice.certificate.poolId
                                            )}
                                            {@const source = pool
                                                ? (poolName?.(pool) ?? pool.name).replace(
                                                      'Treasury shares',
                                                      'Treasury'
                                                  )
                                                : session.ownerName(choice.certificate.owner)}
                                            {@const count = ownership.find(
                                                (entry) =>
                                                    entry.poolId === choice.certificate.poolId &&
                                                    sameOwner(entry.owner, choice.certificate.owner)
                                            )?.shares}
                                            <button
                                                class="share-source"
                                                {disabled}
                                                aria-label={`Buy ${company.name} from ${source} for ${optionalMoney(money, choice.result.details?.price)}`}
                                                data-purchase-certificate={choice.certificate.id}
                                                onclick={() => {
                                                    session.stock.selectPurchase(choice.request)
                                                    void session.stock.confirmPurchase()
                                                }}
                                            >
                                                <span class="source-label"
                                                    >{source}
                                                    {#if choice.certificate.number !== undefined}<small
                                                            >Share #{choice.certificate
                                                                .number}</small
                                                        >{/if}
                                                    {#if choice.certificate.president || choice.certificate.shares !== 1}<small
                                                            >{choice.certificate.shares} shares{choice
                                                                .certificate.president
                                                                ? ' · President'
                                                                : ''}</small
                                                        >{/if}
                                                </span>
                                                <span class="share-count">{count}</span>
                                                {#if prices.length > 1}<small
                                                        >{optionalMoney(
                                                            money,
                                                            choice.result.details?.price
                                                        )}</small
                                                    >{/if}
                                            </button>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                            {#if playerPayments.some((amount) => amount > 0)}
                                <div class="player-payment">
                                    YOU PAY {playerPayments
                                        .map((amount) => `${money(amount)}`)
                                        .join(' / ')}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {:else if menu === 'start'}
                    <div class="start-selection">
                        <div class="choices start-choices">
                            {#each buyerStarts as choice, index (index)}
                                <button
                                    class="company-choice start-company-choice"
                                    {disabled}
                                    aria-label={`Start ${getCompany(session.gameState, choice.request.companyId).name}`}
                                    aria-pressed={session.stock.selectedStartCompany?.companyId ===
                                        choice.request.companyId}
                                    data-start-company={choice.request.companyId}
                                    onclick={() => session.stock.selectCompanyStart(choice.request)}
                                >
                                    {@render token(choice.request.companyId)}
                                </button>
                            {/each}
                        </div>
                        {#if session.stock.selectedStartCompany}
                            {@const sharesToFloat = session.sharesToFloat(
                                session.stock.selectedStartCompany.companyId
                            )}
                            <div class="choices par-choices">
                                {#each session.stock.selectedStartPrices as price (price.marketSpaceId)}
                                    {#if price.result.details}
                                        {@const space = stockMarketSpace(
                                            session.gameState.stockMarket,
                                            price.marketSpaceId
                                        )}
                                        <button
                                            class="par-choice"
                                            {disabled}
                                            style:background={marketColors[space.color] ??
                                                space.color}
                                            data-start-price={price.result.details.parPrice}
                                            onclick={() => {
                                                session.stock.selectStartPrice(price.marketSpaceId)
                                                void session.stock.confirmStart()
                                            }}
                                        >
                                            <span class="par-value"
                                                >{price.result.details.parPrice}</span
                                            >
                                            <small>Cost {money(price.result.details.price)}</small>
                                            {#if sharesToFloat !== undefined}
                                                <small class="float-cost"
                                                    >{money(
                                                        sharesToFloat *
                                                            price.result.details.parPrice
                                                    )} to float</small
                                                >
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
                            {#each session.stockCompanies.filter( (company) => sales.some((choice) => choice.sale.companyId === company.id) ) as company (company.id)}
                                {@const owned = session.myPlayer
                                    ? sharesOwned(session.gameState, company.id, {
                                          kind: 'player',
                                          playerId: session.myPlayer.id
                                      })
                                    : 0}
                                <button
                                    class="share-identity sale-company"
                                    {disabled}
                                    aria-label={`Sell ${company.name}`}
                                    aria-pressed={session.stock.selectedSaleCompany === company.id}
                                    data-sale-company={company.id}
                                    onclick={() => {
                                        session.stock.cancel()
                                        session.stock.chooseSaleCompany(company.id)
                                        if (owned === 1) {
                                            const choice = sales.find(
                                                (choice) =>
                                                    choice.sale.companyId === company.id &&
                                                    choice.sale.shares === 1
                                            )
                                            assertExists(
                                                choice,
                                                'A single owned share requires an available sale'
                                            )
                                            session.stock.selectSale(choice.request)
                                            void session.stock.confirmSale()
                                        }
                                    }}
                                >
                                    <span class="owned-shares">{owned}</span>
                                    <CompanyToken
                                        appearance={session.mapView.stations[company.id]}
                                        size={30}
                                    />
                                    <span class="share-value"
                                        >{money(
                                            session.gameState.stockRound.turn.saleBlocks?.find(
                                                (block) =>
                                                    block.companyId === company.id &&
                                                    block.seller.kind === 'player' &&
                                                    block.seller.playerId === session.myPlayer?.id
                                            )?.price ??
                                                companyMarketSpace(
                                                    session.gameState.stockMarket,
                                                    company.id
                                                ).price
                                        )}</span
                                    >
                                </button>
                            {/each}
                        </div>
                        {#if session.stock.selectedSaleCompany}
                            <div class="quantity-heading">HOW MANY</div>
                            <div class="choices">
                                {#each sales.filter((choice) => choice.sale.companyId === session.stock.selectedSaleCompany) as choice, index (index)}
                                    <button
                                        class="sale-quantity"
                                        {disabled}
                                        data-sale-shares={choice.sale.shares}
                                        aria-label={`Sell ${choice.sale.shares} shares for ${optionalMoney(money, choice.result.details?.proceeds)}`}
                                        aria-pressed={!!session.stock.selectedSale &&
                                            sameOwner(
                                                session.stock.selectedSale.seller,
                                                choice.request.seller
                                            ) &&
                                            session.stock.selectedSale.sales.some(
                                                (sale) =>
                                                    sale.companyId === choice.sale.companyId &&
                                                    sale.shares === choice.sale.shares
                                            )}
                                        onclick={() => {
                                            session.stock.selectSale(choice.request)
                                            void session.stock.confirmSale()
                                        }}
                                    >
                                        <span class="share-count">{choice.sale.shares}</span>
                                        <small
                                            >{optionalMoney(
                                                money,
                                                choice.result.details?.proceeds
                                            )}</small
                                        >
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {:else if menu === 'exchange'}
                    {#each session.privates.exchangeOptions as offer, index (index)}
                        {@const company = exchangeCompany(offer.certificateId)}
                        <button
                            class="exchange-choice"
                            aria-label={`Exchange ${getCompany(session.gameState, offer.privateCompanyId).name} for ${company.name}`}
                            {disabled}
                            onclick={() => {
                                session.privates.selectExchange(offer)
                                void session.privates.confirmExchange()
                            }}
                        >
                            <span class="exchange-private"
                                >{getCompany(session.gameState, offer.privateCompanyId).name}</span
                            >
                            <span class="exchange-arrow" aria-hidden="true">→</span>
                            <span class="exchange-company">
                                <CompanyToken
                                    appearance={session.mapView.stations[company.id]}
                                    size={28}
                                />
                            </span>
                        </button>{/each}
                {/if}
            </div>
        {:else}
            <div class="heading available-shares idle-prompt">Choose an action above</div>
        {/if}
    </div>
    {#if session.stock.turnSales.length}
        <aside class="sales-sidebar" aria-label="Sales summary">
            <table class="sales-summary" aria-label="Sales this turn">
                <caption>SALES THIS TURN</caption>
                <tbody>
                    {#each session.stock.turnSales as sale (sale.companyId)}
                        <tr data-sold-company={sale.companyId}>
                            <th
                                scope="row"
                                aria-label={getCompany(session.gameState, sale.companyId).name}
                            >
                                <CompanyToken
                                    appearance={session.mapView.stations[sale.companyId]}
                                    size={26}
                                />
                            </th>
                            <td>{sale.shares}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </aside>
    {/if}
</section>
<StandingInstruction {session} />

<style>
    section {
        container-type: inline-size;
        padding: 4px 0;
    }
    @container stock-actions (min-width: 500px) {
        section:has(.sales-sidebar) {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 168px;
        }
        section:has(.sales-sidebar) .stock-controls {
            align-self: center;
            min-width: 0;
            padding: 10px 16px;
            container-type: inline-size;
        }
        .sales-sidebar {
            padding: 16px 14px;
            border-left: 1px solid var(--rail-border, #485666);
            background: var(--rail-surface-inset, #1b232d);
        }
        .sales-sidebar .sales-summary {
            margin-top: 0;
        }
    }
    .choices.exchange-list {
        flex-direction: column;
        align-items: stretch;
        width: fit-content;
        max-width: 100%;
        margin-inline: auto;
        gap: 4px;
    }
    button.exchange-choice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 8px;
        border: 0;
        background: var(--rail-surface-raised, #eee6da);
        text-align: left;
    }
    button.exchange-choice:hover:not(:disabled) {
        background: var(--rail-surface-selected, #dfd1be);
        color: var(--rail-text, #352b21);
    }
    .exchange-private {
        flex: 1;
        font-weight: 400;
    }
    .exchange-arrow {
        color: var(--rail-muted, #95816a);
        font-size: 16px;
    }
    .exchange-company {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }
    .share-offer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .player-payment {
        color: #fff8e9;
        font-size: 10px;
        line-height: 14px;
        text-align: center;
        letter-spacing: 0.04em;
    }
    .share-pill {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
    }
    .share-identity {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 15px;
        padding: 4px 8px;
        align-self: stretch;
        background: var(--rail-surface-raised, #f3ede4);
    }
    .share-offer .share-identity {
        gap: 12px;
        padding: clamp(4px, 1cqw, 10px) clamp(8px, 2cqw, 18px);
    }
    .share-identity :global(svg) {
        flex-shrink: 0;
    }
    .float-band {
        padding: 3px 6px;
        background: var(--rail-solid, #493b2b);
        color: #fff8e9;
        font-size: 10px;
        line-height: 12px;
        text-align: center;
    }
    .share-sources {
        display: flex;
        align-self: stretch;
    }
    button.share-source {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: clamp(3px, 0.8cqw, 8px) clamp(7px, 1.6cqw, 16px);
        border: 0;
        border-radius: 0;
        background: var(--rail-surface-inset, #1b232d);
        text-align: center;
    }
    .share-source + .share-source::before {
        content: '';
        position: absolute;
        left: 0;
        top: 7px;
        bottom: 7px;
        border-left: 1px solid var(--rail-border, #d8cbbc);
    }
    .source-label {
        font-size: 9px;
        line-height: 11px;
        text-transform: uppercase;
        letter-spacing: 0.035em;
        color: var(--rail-text, #786550);
    }
    .share-count {
        font-size: 18px;
        line-height: 20px;
        font-variant-numeric: tabular-nums;
    }
    .owned-shares {
        font-size: 30px;
        line-height: 30px;
        font-variant-numeric: tabular-nums;
    }
    button.sale-company {
        font-size: 15px;
        gap: 12px;
    }
    button.sale-quantity {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px 10px;
    }
    button.sale-company[aria-pressed='true'] {
        background: var(--rail-surface-raised, #e5d7c3);
    }
    button.sale-quantity[aria-pressed='true'] {
        background: var(--rail-surface-raised, #e5d7c3);
        box-shadow: none;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 8px;
    }
    .buy-choices {
        flex-wrap: var(--stock-buy-wrap, wrap);
        overflow-x: var(--stock-buy-overflow, visible);
        justify-content: safe center;
        padding-block: 2px 6px;
    }
    button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        padding: 7px 14px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
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
        border-color: var(--rail-focus, #8c7050);
        background: var(--rail-surface-raised, #e5d7c3);
        box-shadow: inset 0 0 0 1px var(--rail-shadow, #8c7050);
    }
    .company-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 66px;
        padding: 7px 9px;
    }
    .quantity-heading {
        margin-top: 8px;
        text-align: center;
        font-size: 11px;
        letter-spacing: 0.08em;
        color: var(--rail-text, #63513e);
    }
    .sales-summary {
        margin: 16px auto 0;
        border-collapse: collapse;
        min-width: 90px;
        max-width: 100%;
    }
    .sales-summary caption {
        white-space: nowrap;
        padding-bottom: 8px;
        font-size: clamp(10px, calc(8px + 0.5cqw), 13px);
        letter-spacing: 0.08em;
    }
    .sales-summary th {
        padding: 8px 14px 0 6px;
        font-weight: normal;
    }
    .sales-summary tr:first-child th,
    .sales-summary tr:first-child td {
        padding-top: 4px;
    }
    .sales-summary th :global(svg) {
        width: clamp(18px, calc(12px + 2cqw), 32px);
        height: auto;
    }
    .sales-summary td {
        padding: 8px 6px 0 0;
        text-align: right;
        font-size: clamp(13px, calc(8px + 1.5cqw), 23px);
        font-variant-numeric: tabular-nums;
    }
    .start-selection {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .choices.start-choices {
        gap: 3px;
    }
    button.start-company-choice[aria-pressed='true'] {
        background: var(--rail-surface-raised, #e5d7c3);
        box-shadow: none;
    }
    button.par-choice {
        color: #39352f;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 5px 10px;
        border-color: var(--rail-shadow, #00000026);
    }
    .par-choice small {
        color: #39352f;
    }
    .par-choice .float-cost {
        font-weight: 700;
    }
    button.par-choice:hover:not(:disabled) {
        filter: brightness(0.95);
    }
    .par-value {
        font-size: 24px;
        line-height: 26px;
        font-variant-numeric: tabular-nums;
    }
    button.start-company-choice {
        min-width: 0;
        padding: 4px;
        border-color: transparent;
        background: transparent;
    }
    button.start-company-choice:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    small {
        display: block;
        font-size: 10px;
        color: var(--rail-text, #786550);
    }
    .heading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
        font-size: 13px;
    }
    .heading.available-shares {
        font-size: clamp(11px, calc(9px + 0.5cqw), 14px);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--rail-text, #63513e);
    }
    .heading.idle-prompt {
        margin-bottom: 0;
    }
    .owner-cash {
        margin-left: 5px;
        font-variant-numeric: tabular-nums;
    }
    .owner-toggle {
        gap: 7px;
        min-height: 22px;
    }
    .owner-toggle button,
    .owner-toggle button:hover:not(:disabled),
    .owner-toggle button[aria-pressed='true'] {
        border: 0;
        position: relative;
        border-radius: 999px;
        padding: 3px 8px;
        background: transparent;
        box-shadow: none;
        color: var(--rail-text, #786550);
        font-size: 13px;
    }
    .owner-toggle button[aria-pressed='true'],
    .owner-toggle button[aria-pressed='true']:hover:not(:disabled) {
        color: #ffffff;
        font-weight: 700;
    }
    .owner-toggle button:hover:not(:disabled) {
        color: var(--rail-text, #443c34);
    }
    .notice {
        text-align: center;
        font-size: 12px;
        margin: 0 0 8px;
    }
</style>
