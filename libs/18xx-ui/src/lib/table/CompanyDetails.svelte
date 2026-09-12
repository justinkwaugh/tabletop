<script lang="ts">
    import { assertExists } from '@tabletop/common'
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
    import { companyOwnership } from '../finance/companyOwnership.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    let {
        session,
        company,
        trainColors,
        privateOperationDescription,
        poolName = (pool) => pool.name
    }: {
        session: FinanceExampleSession
        trainColors: Readonly<Record<string, string>>
        company: Company
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
        poolName?: (pool: CertificatePool) => string
    } = $props()
    const state = $derived(session.financialState)
    const owner = $derived({ kind: 'company', companyId: company.id } as const)
    const cash = $derived(cashOwnedBy(state, owner))
    const control = $derived(controllingOwner(state, company.id))
    const ownership = $derived(companyOwnership(state, company.id))
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

<section class="company-detail" aria-label={`${company.name} details`}>
    <header>
        <div class="identity">
            <CompanyToken appearance={session.mapView.stations[company.id]} size={28} />
            <div>
                <h2>{company.name}</h2>
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
            {#if remainingStations.length}
                <div class="remaining-tokens" role="group" aria-label="Remaining station tokens">
                    {#each remainingStations as station (station.id)}
                        {@const cost = session.stationPlacementCost(station.id)}
                        <div
                            class="token-cost"
                            aria-label={`Station token, $${cost}`}
                            title={`Station placement: $${cost}`}
                        >
                            <CompanyToken
                                appearance={session.mapView.stations[company.id]}
                                size={20}
                            />
                            <span>{cost}</span>
                        </div>
                    {/each}
                </div>
            {/if}
            <div class="prices">
                {#if marketPrice !== undefined}<div>
                        <span>Market</span><strong>{marketPrice}</strong>
                    </div>{/if}
                {#if company.parPrice !== undefined}<div>
                        <span>Par</span><strong>${company.parPrice}</strong>
                    </div>{/if}
                <div>
                    <span>Cash</span><strong
                        >{cash === undefined
                            ? '—'
                            : cash === 'unlimited'
                              ? '$∞'
                              : `$${cash.toLocaleString('en-US')}`}</strong
                    >
                </div>
            </div>
        </div>
    </header>
    <div class="detail-columns">
        <section aria-label="Company ownership">
            <div class="ownership-heading">
                <h3>Ownership</h3>
                {#if company.president?.kind === 'company' && control}
                    <p class="control">(Controlled by {session.ownerName(control)})</p>
                {/if}
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
                            >
                                <th scope="row" title={president ? 'President' : undefined}
                                    >{ownershipName(entry)}{#if president}<PresidentBadge
                                        />{/if}</th
                                >
                                <td title="Shares">{entry.shares}</td>

                                {#if numberedShares}<td title="Certificate numbers"
                                        >{entry.certificateNumbers.join(', ') || '—'}</td
                                    >{/if}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {:else}<p class="empty">No issued shares.</p>{/if}
        </section>
        <section aria-label="Company assets">
            <section aria-label="Private companies and powers">
                <h3>Privates & powers</h3>
                {#each privates as item (item.id)}
                    {@render privateCard(item)}
                {:else}<p class="empty">None</p>{/each}
                {#if personalPrivates.length && control}
                    <hr />
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
    </div>
</section>

{#snippet privateCard(item: (typeof session.privateCompanies)[number], purchasePrice?: string)}
    {@const description = privateOperationDescription(item.id, company.id)}
    <article class="private" data-private-description-row>
        <div class="private-heading">
            <div class="private-name"><PrivateDescription name={item.name} description={item.description} income={item.closed ? undefined : item.privateRevenue} /></div
            ><span
                >{purchasePrice ??
                    (item.closed ? 'Closed' : `$${item.privateRevenue ?? 0} / OR`)}</span
            >
        </div>
        {#if !item.closed && description}<p>{description}</p>{/if}
        {#if state.usedPrivatePowerIds.includes(item.id)}<span class="status"
                >One-time power used</span
            >{/if}
    </article>
{/snippet}

<style>
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
        margin: 1px 0 0;
        font-size: 11px;
        line-height: 14px;
        color: #887664;
    }
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
