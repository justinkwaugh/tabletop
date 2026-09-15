<script lang="ts">
    import {
        cashOwnedBy,
        certificatesInPool,
        getCompany,
        sharesOwned,
        type Company,
        type Owner,
        type ValuationRules
    } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    import { ownerPortfolio } from '../finance/ownerPortfolio.js'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    import OperatingHistory from './OperatingHistory.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        session,
        marketPoolId,
        exchangePoolId,
        valuationRules,
        companyNames = {},
        portfolioCompanyIds = []
    }: {
        session: FinanceExampleSession
        marketPoolId: string
        exchangePoolId?: string
        valuationRules: ValuationRules
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        portfolioCompanyIds?: readonly string[]
    } = $props()
    const companies = $derived(
        session.financialState.companies.filter(
            (company) =>
                !company.closed &&
                (company.shareCount !== undefined ||
                    session.financialState.certificates.some(
                        (certificate) =>
                            certificate.kind === 'share' &&
                            !certificate.retired &&
                            certificate.companyId === company.id
                    ))
        )
    )
    let showIncome = $state(false)
    let view = $state<'Company' | 'Player'>('Player')
    const firstPoolId = $derived(exchangePoolId ? 'exchange' : 'treasury')
    function poolShares(poolId: string, companyId: string): number {
        return certificatesInPool(session.financialState, poolId).reduce(
            (sum, certificate) =>
                sum +
                (certificate.kind === 'share' && certificate.companyId === companyId
                    ? certificate.shares
                    : 0),
            0
        )
    }
    const owners = $derived([
        ...session.playerPriorityOrder.map((playerId) => ({
            id: `player:${playerId}`,
            name: session.getPlayerName(playerId),
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, { kind: 'player', playerId })
        })),
        ...portfolioCompanyIds.map((ownerId) => ({
            id: `company:${ownerId}`,
            name: getCompany(session.financialState, ownerId).name,
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, {
                    kind: 'company',
                    companyId: ownerId
                })
        })),
        ...(exchangePoolId
            ? [
                  {
                      id: 'exchange',
                      name: 'Exchange',
                      count: (companyId: string) => poolShares(exchangePoolId, companyId)
                  }
              ]
            : []),
        {
            id: 'treasury',
            name: 'Treasury',
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, { kind: 'company', companyId })
        },
        {
            id: 'market',
            name: 'Market',
            count: (companyId: string) => poolShares(marketPoolId, companyId)
        }
    ])
    const rows = $derived(
        companies.map((company) => ({
            company,
            cash: cashOwnedBy(session.financialState, { kind: 'company', companyId: company.id }),
            presidentId:
                company.president?.kind === 'player'
                    ? `player:${company.president.playerId}`
                    : company.president?.kind === 'company'
                      ? `company:${company.president.companyId}`
                      : undefined,
            shares: owners.map((owner) => owner.count(company.id))
        }))
    )
    const statisticLabels = ['Cash', 'Net worth', 'Shares', 'Certs']
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    function financialValues(owner: Owner, certs = '—'): string[] {
        const { cash, netWorth, shares } = ownerPortfolio(
            session.financialState,
            owner,
            valuationRules
        )
        return [`$${money.format(cash)}`, `$${money.format(netWorth)}`, String(shares), certs]
    }
    const statistics = $derived(
        new Map([
            ...session.playerPriorityOrder.map((playerId): [string, string[]] => {
                const certs = session.playerCertificates(playerId)
                return [
                    `player:${playerId}`,
                    financialValues({ kind: 'player', playerId }, `${certs.count}/${certs.limit}`)
                ]
            }),
            ...portfolioCompanyIds.map((companyId): [string, string[]] => [
                `company:${companyId}`,
                financialValues({ kind: 'company', companyId })
            ])
        ])
    )
</script>

{#snippet companyCash(cash: number | 'unlimited' | undefined)}
    {cash === undefined ? '—' : cash === 'unlimited' ? '∞' : `$${money.format(cash)}`}
{/snippet}

{#snippet shareCell(shares: number, poolStart = false, president = false)}
    <td class:empty={shares === 0} class:pool-start={poolStart}>
        <span class="share-value" class:president
            >{shares}{#if president}<span class="badge"><PresidentBadge /></span>{/if}</span
        >
    </td>
{/snippet}

{#snippet companyLabel(company: Company)}
    <span class="company">
        {#if session.mapView.stations[company.id]}
            <CompanyToken appearance={session.mapView.stations[company.id]} size={22} />
        {/if}
        <span title={company.name}>{companyNames[company.id]?.initials ?? company.id}</span>
    </span>
{/snippet}

<div class="spreadsheet">
    <div class="toolbar">
        <div class="view-toggle" role="group" aria-label="Spreadsheet view">
            {#each ['Player', 'Company'] as option}
                <button
                    aria-pressed={view === option}
                    onclick={() => (view = option === 'Company' ? 'Company' : 'Player')}
                    >{option}</button
                >
            {/each}
        </div>
        <div class="view-toggle" role="group" aria-label="Spreadsheet period">
            <button aria-pressed={!showIncome} onclick={() => (showIncome = false)}>Current</button>
            <button aria-pressed={showIncome} onclick={() => (showIncome = true)}>Income</button>
        </div>
    </div>
    {#if showIncome}
        <OperatingHistory {session} {valuationRules} {view} {companyNames} />
    {:else}
        <table aria-label="Company share ownership" class:transposed={view === 'Player'}>
            <thead>
                <tr>
                    <th scope="col">{view}</th>
                    {#if view === 'Company'}
                        {#each owners as owner (owner.id)}<th
                                scope="col"
                                class:pool-start={owner.id === firstPoolId}>{owner.name}</th
                            >{/each}
                        <th scope="col" class="company-stat-start">Cash</th>
                    {:else}
                        {#each companies as company (company.id)}
                            <th scope="col" aria-label={company.name}
                                >{@render companyLabel(company)}</th
                            >
                        {/each}
                        {#each statisticLabels as label, index}<th
                                scope="col"
                                class:stat-start={index === 0}>{label}</th
                            >{/each}
                    {/if}
                </tr>
            </thead>
            <tbody>
                {#if view === 'Company'}
                    {#each rows as row (row.company.id)}
                        <tr>
                            <th scope="row" aria-label={row.company.name}
                                >{@render companyLabel(row.company)}</th
                            >
                            {#each row.shares as shares, index}{@render shareCell(
                                    shares,
                                    owners[index].id === firstPoolId,
                                    row.presidentId === owners[index].id
                                )}{/each}
                            <td class="company-stat-start">{@render companyCash(row.cash)}</td>
                        </tr>
                    {/each}
                    {#each statisticLabels as label, index}
                        <tr class:stat-start={index === 0}>
                            <th scope="row">{label}</th>
                            {#each owners as owner (owner.id)}
                                <td
                                    class:pool-start={owner.id === firstPoolId}
                                    class:empty={!statistics.has(owner.id)}
                                    >{statistics.get(owner.id)?.[index] ?? '—'}</td
                                >
                            {/each}
                            <td class="company-stat-start empty">—</td>
                        </tr>
                    {/each}
                {:else}
                    {#each owners as owner, index (owner.id)}
                        <tr class:pool-start={owner.id === firstPoolId}>
                            <th scope="row">{owner.name}</th>
                            {#each rows as row (row.company.id)}{@render shareCell(
                                    row.shares[index],
                                    false,
                                    row.presidentId === owner.id
                                )}{/each}
                            {#each statisticLabels as _, statIndex}
                                <td
                                    class:stat-start={statIndex === 0}
                                    class:empty={!statistics.has(owner.id)}
                                    >{statistics.get(owner.id)?.[statIndex] ?? '—'}</td
                                >
                            {/each}
                        </tr>
                    {/each}
                    <tr class="company-stat-start">
                        <th scope="row">Cash</th>
                        {#each rows as row (row.company.id)}<td>{@render companyCash(row.cash)}</td
                            >{/each}
                        {#each statisticLabels as _, index}<td
                                class:stat-start={index === 0}
                                class="empty">—</td
                            >{/each}
                    </tr>
                {/if}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .share-value {
        position: relative;
        display: inline-block;
    }
    .share-value.president {
        font-weight: 650;
    }
    .badge {
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
    }
    .toolbar {
        display: flex;
        gap: 12px;
    }
    .view-toggle {
        display: flex;
        width: max-content;
        border: 1px solid #c7b8a6;
        border-radius: 6px;
        overflow: hidden;
        margin: 4px 0 10px;
    }
    .view-toggle button {
        border: 0;
        padding: 4px 12px;
        font: inherit;
        font-size: 12px;
        color: #786550;
        background: transparent;
        cursor: pointer;
    }
    .view-toggle button[aria-pressed='true'] {
        background: #695540;
        color: #fffaf4;
    }
    .view-toggle button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: -2px;
    }
    .transposed .company {
        justify-content: center;
    }
    .spreadsheet {
        container-type: inline-size;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin: 8px 0;
    }
    th,
    td {
        padding: 4px 12px;
        border-bottom: 1px solid #d2c5b7;
    }
    thead th {
        white-space: nowrap;
        font-size: 12px;
        color: #786550;
        font-weight: 600;
    }
    th:first-child {
        text-align: left;
        padding-left: 0;
    }
    tbody th {
        font-weight: 500;
    }
    td {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .stat-start > th,
    .stat-start > td {
        border-top: 2px solid #c7b8a6;
    }
    .transposed .stat-start {
        border-left: 2px solid #c7b8a6;
    }
    table:not(.transposed) .pool-start {
        border-left: 2px solid #a18b74;
    }
    .transposed tr.pool-start > th,
    .transposed tr.pool-start > td {
        border-top: 2px solid #a18b74;
    }
    table:not(.transposed) .company-stat-start {
        border-left: 2px solid #a18b74;
    }
    .transposed tr.company-stat-start > th,
    .transposed tr.company-stat-start > td {
        border-top: 2px solid #a18b74;
    }
    .empty {
        color: #a79888;
    }
    @container (max-width: 800px) {
        th,
        td {
            padding-inline: 9px;
        }
    }
    @container (max-width: 560px) {
        th,
        td {
            padding-inline: 6px;
        }
    }
</style>
