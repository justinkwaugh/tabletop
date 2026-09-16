<script lang="ts">
    import type { Snippet } from 'svelte'
    import { assertExists, type GameAction } from '@tabletop/common'
    import {
        cashOwnedBy,
        certificatesOwnedBy,
        controllingOwner,
        getCompany,
        privateOwner,
        sameOwner,
        companyMarketSpace,
        trainsOwnedBy,
        sharesOwned,
        type Company,
        type CertificatePool
    } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import { type CompanyOwnership, companyOwnership } from '../finance/companyOwnership.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import { companyLastRun } from './companyLastRun.js'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    let {
        session,
        onPreviewMap,
        company,
        displayName = company.name,
        vertical = false,
        unavailable = false,
        purchaseSources,
        canPurchase,
        trainColors,
        privateOperationDescription,
        poolName = (pool) => pool.name
    }: {
        unavailable?: boolean
        vertical?: boolean
        canPurchase?: (entry: CompanyOwnership) => boolean
        purchaseSources?: Snippet<[CompanyOwnership]>
        onPreviewMap?: (action: GameAction) => void
        session: FinanceExampleSession
        trainColors: Readonly<Record<string, string>>
        displayName?: string
        company: Company
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
        poolName?: (pool: CertificatePool) => string
    } = $props()
    const state = $derived(session.financialState)
    const lastRun = $derived(vertical ? undefined : companyLastRun(session.actions, session.gameState.actionCount, company.id))
    const owner = $derived({ kind: 'company', companyId: company.id } as const)
    const cash = $derived(cashOwnedBy(state, owner))
    const control = $derived(controllingOwner(state, company.id))
    const sellers = $derived(state.machineState === 'StockRound' && !state.stockRound.completed
        ? state.stockRound.sales.filter((sale) => sale.companyId === company.id).map((sale) => sale.owner)
        : [])
    const ownership = $derived(companyOwnership(state, company.id, sellers))
    const sharePoolsStart = $derived(
        ownership.findIndex((entry) => entry.owner.kind === 'bank' || sameOwner(entry.owner, owner))
    )
    const numberedShares = $derived(ownership.some((row) => row.certificateNumbers.length))
    const marketPrice = $derived(
        state.stockMarket.stacks.some((stack) => stack.companyIds.includes(company.id))
            ? companyMarketSpace(state.stockMarket, company.id).price
            : undefined
    )
    const trains = $derived(trainsOwnedBy(state, owner))
    const stations = $derived(state.stations.filter((station) => station.companyId === company.id))
    const remainingStations = $derived(stations.filter((station) => station.status === 'available'))
    const tokenGroups = $derived.by(() => {
        const counts = new Map<number, number>()
        for (const station of remainingStations) {
            const cost = session.stationPlacementCost(station.id)
            counts.set(cost, (counts.get(cost) ?? 0) + 1)
        }
        return [...counts].sort(([a], [b]) => a - b).map(([cost, count]) => ({ cost, count }))
    })
    const investments = $derived(
        certificatesOwnedBy(state, owner).filter(
            (certificate) => certificate.kind === 'share' && certificate.companyId !== company.id
        )
    )
    const investmentCompanies = $derived([
        ...new Set(investments.map((certificate) => certificate.companyId))
    ])
    const privates = $derived(
        session.privateCompanies.filter((item) => {
            const privateCompanyOwner = privateOwner(state, item.id)
            return privateCompanyOwner && sameOwner(privateCompanyOwner, owner)
        })
    )
    const personalPrivates = $derived(
        session.privateCompanies.flatMap((item) => {
            const privateCompanyOwner = privateOwner(state, item.id)
            const priceRange = session.privatePurchasePriceRange(company.id, item.id)
            return !item.closed &&
                privateCompanyOwner &&
                control &&
                sameOwner(privateCompanyOwner, control) &&
                priceRange
                ? [{ ...item, maximumPrice: priceRange.maximum }]
                : []
        })
    )
    function poolLabel(poolId: string): string {
        const pool = state.certificatePools.find((entry) => entry.id === poolId)
        assertExists(pool, 'Unknown certificate pool')
        return poolName(pool)
    }
    function ownershipName(entry: (typeof ownership)[number]): string {
        if (entry.poolId) return poolLabel(entry.poolId)
        return sameOwner(entry.owner, owner) ? 'Treasury' : session.ownerName(entry.owner)
    }
</script>

<article class="company-detail" class:vertical class:unavailable aria-label={`${company.name} details`}>
    <header>
        <div class="identity">
            <CompanyToken appearance={session.mapView.stations[company.id]} size={28} />
            <div>
                <h2>{displayName}</h2>
                <div class="train-roster" aria-label="Trains">
                    {#each trains as train (train.id)}
                        {@const definition = session.trainDepot.trainDefinition(train.definitionId)}
                        <TrainBadge
                            name={definition.name}
                            color={trainColors[train.definitionId]}
                            title={definition.distance.maximum === 'unlimited'
                                ? 'Unlimited'
                                : `${definition.distance.maximum} ${definition.distance.measure === 'hex-edges' ? 'hex edges' : definition.distance.measure === 'cities-and-offboards' ? 'cities / offboards + towns' : 'revenue centers'}`}
                        />
                        {#if train.status === 'owned' && train.rustsAfterOperation}
                            <span class="status">Rusts after running</span>
                        {/if}
                    {:else}<span
                            class="empty"
                            class:train-required={session.companyRequiresTrain(company.id)}
                            title={session.companyRequiresTrain(company.id)
                                ? 'Must buy a train when operating'
                                : undefined}>No trains</span
                        >{/each}
                </div>
                {#if company.closed}<p class="subtitle">Closed</p>{/if}
            </div>
        </div>
        <div class="header-summary">
            <div class="remaining-tokens" role="group" aria-label="Remaining station tokens">
                {#if !vertical}
                    {#each remainingStations as station (station.id)}
                        {@const cost = session.stationPlacementCost(station.id)}
                        <div class="token-cost" aria-label={`Station token, $${cost}`}>
                            <CompanyToken appearance={session.mapView.stations[company.id]} size={20} />
                            <span>{cost}</span>
                        </div>
                    {/each}
                {:else}
                {#each tokenGroups as group (group.cost)}
                    <div class="token-cost" aria-label={`${group.count} station tokens, $${group.cost} each`}>
                        <div class="token-count"><span>{group.count}</span><CompanyToken appearance={session.mapView.stations[company.id]} size={20} /></div>
                        <span class="token-price">{group.cost}</span>
                    </div>
                {:else}
                    <div class="token-count exhausted" aria-label="0 station tokens remaining">
                        <span>0</span><CompanyToken appearance={session.mapView.stations[company.id]} size={20} />
                    </div>
                {/each}
                {/if}
            </div>
        </div>
    </header>
    <div class="financial-summary">{@render prices()}</div>
    <div class="detail-columns">
        <section aria-label="Company ownership">
            <div class="ownership-heading">
                <h3>Ownership</h3>
            </div>
            {#if ownership.length}
                <table aria-label={`${company.name} share ownership`}>
                    <tbody>
                        {#each ownership as entry, index}
                            {@const president =
                                company.president && sameOwner(entry.owner, company.president)}
                            <tr
                                class:pool-divider={index > 0 && index === sharePoolsStart}
                                class:president
                                class:sold={sellers.some((seller) => sameOwner(seller, entry.owner))}
                                class:investor-owner={entry.owner.kind === 'player' || (entry.owner.kind === 'company' && !sameOwner(entry.owner, owner))}
                            >
                                {#if purchaseSources && canPurchase?.(entry)}
                                    <td class="purchase-cell" colspan={numberedShares ? 3 : 2}>{@render purchaseSources(entry)}</td>
                                {:else}
                                <th scope="row" title={president ? 'President' : undefined}
                                    >{ownershipName(entry)}{#if president}<PresidentBadge
                                        />{/if}{#if president && entry.owner.kind === 'company' && control}<span class="control"> ({session.ownerName(control)})</span>{/if}</th
                                >
                                <td title="Shares">{entry.shares || '—'}</td>

                                {#if numberedShares}<td title="Certificate numbers"
                                        >{entry.certificateNumbers.join(', ') || '—'}</td
                                    >{/if}
                                {/if}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {:else}<p class="empty">No issued shares.</p>{/if}
        </section>
        {#if !vertical || privates.length || personalPrivates.length || investmentCompanies.length}
        <section aria-label="Company assets">
            <section aria-label="Private companies and powers">
                {#if !vertical || privates.length}
                <h3>Privates & powers</h3>
                {#each privates as item (item.id)}
                    {@render privateCard(item)}
                {:else}<p class="empty">None</p>{/each}
                {/if}
                {#if personalPrivates.length && control}
                    {#if !vertical || privates.length}<hr />{/if}
                    <h3>Purchasable privates</h3>
                    {#each personalPrivates as item (item.id)}
                        {@render privateCard(
                            item,
                            item.maximumPrice === undefined ? 'No maximum' : `$${item.maximumPrice}`
                        )}
                    {/each}
                {/if}
            </section>
            {#if investmentCompanies.length}
                <h3 class="section-heading">Investments</h3>
                {#each investmentCompanies as id}<p class="investment">
                        {getCompany(state, id).name}<strong
                            >{sharesOwned(state, id, owner)} shares</strong
                        >
                    </p>{/each}
            {/if}
        </section>
        {/if}
    </div>
</article>

{#snippet prices()}
            <div class="prices">
                {@render cashValue()}
                {#if company.parPrice !== undefined}<div>
                        <span>Par</span><strong>${company.parPrice}</strong>
                    </div>{/if}
                {@render marketValue()}
                {#if !vertical}
                    <div>
                        <span>Last run</span>
                        {#if lastRun?.metadata && onPreviewMap}
                            <button class="last-run" disabled={session.busy || session.updatingVisibleState}
                                aria-label={`View ${company.name}'s last run for $${lastRun.metadata.revenue}`}
                                onclick={() => onPreviewMap?.(lastRun!)}>${lastRun.metadata.revenue.toLocaleString('en-US')}</button>
                        {:else}<strong>—</strong>{/if}
                    </div>
                {/if}
            </div>
{/snippet}

{#snippet marketValue()}
                {#if marketPrice !== undefined}<div>
                        <span>Market</span><strong>{marketPrice}</strong>
                    </div>{/if}
{/snippet}

{#snippet cashValue()}
                <div>
                    <span>Cash</span><strong
                        >{cash === undefined
                            ? '—'
                            : cash === 'unlimited'
                              ? '$∞'
                              : `$${cash.toLocaleString('en-US')}`}</strong
                    >
                </div>
{/snippet}

{#snippet privateCard(item: (typeof session.privateCompanies)[number], purchasePrice?: string)}
    {@const description = privateOperationDescription(item.id, company.id)}
    <article class="private" data-private-description-row>
        <div class="private-heading">
            <div class="private-name"><PrivateDescription token={session.privateCompanyTokens[item.id]} name={item.name} description={item.description} income={item.closed ? undefined : item.privateRevenue} /></div
            ><span
                >{purchasePrice ??
                    (item.closed ? 'Closed' : `$${item.privateRevenue ?? 0} / OR`)}</span
            >
        </div>
        {#if !vertical && !item.closed && description}<p>{description}</p>{/if}
        {#if state.usedPrivatePowerIds.includes(item.id)}<span class="status"
                >One-time power used</span
            >{/if}
    </article>
{/snippet}

<style>
    .company-detail.unavailable { background: #f1f1ef; border-color: #d0d0cd; }
    .company-detail.unavailable header { background: #dededb; }
    .company-detail.unavailable .identity > div,
    .company-detail.unavailable .header-summary,
    .company-detail.unavailable .financial-summary,
    .company-detail.unavailable .detail-columns { opacity: .5; filter: grayscale(1); }
    .company-detail.vertical { width: 200px; margin: 0; border-radius: 7px; }
    .vertical header { flex-wrap: wrap; gap: 5px; background: #e5dccf; }
    .vertical .identity { flex-shrink: 1; gap: 7px; }
    .vertical h2 { white-space: normal; font-size: 13px; line-height: 1.2; }
    .vertical .header-summary { padding-left: 0; }
    .vertical .detail-columns { grid-template-columns: minmax(0, 1fr); min-width: 0; max-height: none; contain: none; overflow: visible; }
    .company-detail.vertical .detail-columns > section { padding: 7px 10px; }
    .company-detail.vertical .detail-columns > section + section { border-left: 0; border-top: 1px solid #e3d9cd; }
    .financial-summary { padding: 7px 10px; border-bottom: 1px solid #e3d9cd; }
    .financial-summary .prices { gap: 0; }
    .financial-summary .prices div { position: relative; flex: 1; text-align: center; }
    .financial-summary .prices div + div::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 12px; border-left: 1px solid #e3d9cd; }
    .vertical tr > th,
    .vertical tr > td { padding-top: 0; padding-bottom: 0; line-height: 17px; }
    .vertical tr.investor-owner:has(+ .pool-divider) > th,
    .vertical tr.investor-owner:has(+ .pool-divider) > td { padding-bottom: 6px; }
    td.purchase-cell { padding: 0; }
    .vertical tr.pool-divider > th,
    .vertical tr.pool-divider > td { padding-top: 6px; }
    .company-detail {
        width: fit-content;
        max-width: 100%;
        border: 1px solid #d2c5b7;
        border-radius: 10px;
        background: #faf7f1;
        color: #514538;
        margin: 3px 0 8px;
        box-shadow: 0 3px 10px #59432c08;
        overflow: hidden;
    }
    header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 10px;
        border-bottom: 1px solid #e3d9cd;
    }
    .identity {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
    }
    h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        white-space: nowrap;
    }
    .subtitle {
        margin: 2px 0 0;
        color: #887664;
        font-size: 11px;
        text-transform: capitalize;
    }
    .header-summary {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 10px;
        margin-left: auto;
        padding-left: 6px;
    }
    .remaining-tokens {
        display: flex;
        gap: 6px;
    }
    .token-count { display: flex; align-items: center; gap: 3px; font-size: 16px; line-height: 20px; }
    .token-price { align-self: flex-end; width: 20px; text-align: center; }
    .token-count.exhausted { opacity: .45; filter: grayscale(1); }
    .token-cost {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 11px;
        line-height: 11px;
        font-variant-numeric: tabular-nums;
        color: #695540;
    }
    .prices {
        display: flex;
        gap: 16px;
    }
    .prices div {
        display: flex;
        flex-direction: column;
        gap: 0;
        text-align: right;
    }
    .prices span {
        line-height: 12px;
        font-size: 10px;
        color: #887664;
    }
    .last-run { border: 0; border-radius: 4px; padding: 0 4px; margin: 0 auto; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 700; line-height: 16px; cursor: pointer; font-variant-numeric: tabular-nums; }
    .last-run:hover:enabled { background: #ffffff66; }
    .last-run:focus-visible { outline: 2px solid #9e7752; outline-offset: 2px; }
    .last-run:disabled { cursor: default; }
    .prices strong {
        line-height: 16px;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
    .detail-columns {
        display: grid;
        grid-template-columns: 175px minmax(0, 1fr);
        contain: inline-size;
        min-width: 390px;
        max-height: 320px;
        overflow: auto;
    }
    .detail-columns > section {
        min-width: 0;
        padding: 8px 10px;
    }
    .detail-columns > section + section {
        border-left: 1px solid #e3d9cd;
    }
    h3 {
        margin: 0 0 7px;
        font-size: 10px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #887664;
    }
    .ownership-heading {
        margin-bottom: 6px;
    }
    .ownership-heading h3 {
        margin-bottom: 0;
    }
    .control {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 400;
        color: #887664;
    }
    tr.sold { color: #b33a32; }
    .president > th,
    .president > td {
        font-weight: 700;
    }
    .pool-divider > th,
    .pool-divider > td {
        border-top: 1px solid #e3d9cd;
        padding-top: 6px;
    }
    tr:has(+ .pool-divider) > th,
    tr:has(+ .pool-divider) > td {
        padding-bottom: 6px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
    }
    th,
    td {
        padding: 2px 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    th:first-child {
        text-align: left;
    }
    th {
        font-weight: 500;
    }
    td {
        padding-left: 12px;
    }
    .empty {
        margin: 0;
        color: #887664;
        font-size: 12px;
    }
    .train-roster {
        display: flex;
        align-items: center;
        gap: 3px;
        min-height: 16px;
    }
    .train-required {
        color: #b33a32;
    }
    .section-heading {
        margin-top: 12px;
    }
    hr {
        border: 0;
        border-top: 1px solid #e3d9cd;
        margin: 8px 0;
    }
    .investment {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin: 6px 0;
        font-size: 12px;
    }
    .private {
        cursor: pointer;
    }
    .private + .private {
        margin-top: 10px;
    }
    .private-heading {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
    }
    .private-name {
        font-weight: 400;
    }
    .private-heading span {
        white-space: nowrap;
        color: #887664;
        font-size: 11px;
    }
    .private p {
        margin: 1px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: #796958;
    }
    .status {
        font-size: 10px;
        color: #926b3f;
    }
</style>
