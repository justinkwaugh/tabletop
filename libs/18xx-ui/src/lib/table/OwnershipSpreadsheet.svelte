<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { companyLastRun } from './companyLastRun.js'
    import {
        cashOwnedBy,
        isStartCompany,
        certificatesInPool,
        getCompany,
        sharesOwned,
        trainsOwnedBy,
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
    import TrainBadge from '../trains/TrainBadge.svelte'

    let {
        session,
        onPreviewMap,
        operatingCompanyId,
        companyOrder,
        marketPoolId,
        exchangePoolId,
        valuationRules,
        trainColors,
        companyNames = {},
        portfolioCompanyIds = []
    }: {
        companyOrder?: readonly string[]
        operatingCompanyId?: string
        onPreviewMap: (action: GameAction) => void
        session: FinanceExampleSession
        marketPoolId: string
        exchangePoolId?: string
        trainColors: Readonly<Record<string, string>>
        valuationRules: ValuationRules
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        portfolioCompanyIds?: readonly string[]
    } = $props()
    const eligibleCompanies = $derived(
        session.financialState.companies.filter(
            (company) =>
                company.started &&
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
    const companies = $derived.by(() => {
        const starts = session.actions.slice(0, session.gameState.actionCount)
            .filter(isStartCompany).map((action) => action.companyId)
        const order = companyOrder ?? [
            ...eligibleCompanies.filter((company) => !starts.includes(company.id)).map((company) => company.id),
            ...starts
        ]
        return eligibleCompanies.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    })
    let showIncome = $state(false)
    const view = $derived(session.preferences.values.spreadsheetView === 'company' ? 'Company' : 'Player')
    const firstPoolId = 'market'
    const poolColumnLabels: Readonly<Record<string, string>> = { market: 'Mark.', treasury: 'Treas.', exchange: 'Exch.' }
    const portfolioColumnLabels = $derived(new Map(portfolioCompanyIds.map((id) => [
        `company:${id}`, companyNames[id]?.initials ?? id
    ])))
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
        {
            id: 'market',
            name: 'Market',
            count: (companyId: string) => poolShares(marketPoolId, companyId)
        },
        {
            id: 'treasury',
            name: 'Treasury',
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, { kind: 'company', companyId })
        },
        ...(exchangePoolId
            ? [
                  {
                      id: 'exchange',
                      name: 'Exchange',
                      count: (companyId: string) => poolShares(exchangePoolId, companyId)
                  }
              ]
            : [])
    ])
    const rows = $derived(
        companies.map((company) => ({
            company,
            stations: session.financialState.stations.filter((station) => station.companyId === company.id),
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
    const statisticLabels = ['Cash', 'Shares', 'Certs', 'Net worth']
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    function financialValues(owner: Owner, certs = '—'): string[] {
        const { cash, netWorth, shares } = ownerPortfolio(
            session.financialState,
            owner,
            valuationRules
        )
        return [`$${money.format(cash)}`, String(shares), certs, `$${money.format(netWorth)}`]
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

{#snippet lastRunCell(company: Company)}
    {@const run = companyLastRun(session.actions, session.gameState.actionCount, company.id)}
    {#if run?.metadata}
        <button class="last-run" disabled={session.busy || session.updatingVisibleState}
            aria-label={`View ${company.name}'s last run for $${run.metadata.revenue}`}
            onclick={() => onPreviewMap(run)}>${money.format(run.metadata.revenue)}</button>
    {:else}<span class="empty">—</span>{/if}
{/snippet}

{#snippet companyTrains(companyId: string)}
    <span class="company-trains">
        {#each trainsOwnedBy(session.financialState, { kind: 'company', companyId }) as train (train.id)}
            {@const trainName = session.trainDepot.trainDefinition(train.definitionId).name}
            <TrainBadge name={trainName === 'Diesel' ? 'D' : trainName} color={trainColors[train.definitionId]} />
        {:else}<span class="empty">—</span>{/each}
    </span>
{/snippet}

{#snippet shareCell(shares: number, poolStart = false, president = false, matrix = true)}
    <td class:share-cell={matrix} class:empty={shares === 0} class:pool-start={poolStart}>
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
        <div class="view-toggle axis-toggle period-toggle" role="group" aria-label="Spreadsheet period">
            <button aria-pressed={!showIncome} onclick={() => (showIncome = false)}>Current</button>
            <span class="axis-separator" aria-hidden="true"></span>
            <button aria-pressed={showIncome} onclick={() => (showIncome = true)}>Income</button>
        </div>
        <div class="view-toggle axis-toggle" role="group" aria-label="Spreadsheet view">
            {#each ['Player', 'Company'] as option, index}
                {#if index > 0}<span class="axis-separator" aria-hidden="true"></span>{/if}
                <button
                    aria-pressed={view === option}
                    onclick={() => session.preferences.set({ spreadsheetView: option === 'Company' ? 'company' : 'player' }, 'family')}
                    >{option}</button
                >
            {/each}
        </div>
    </div>
    {#if showIncome}
        <OperatingHistory rounds={session.operatingIncomeHistory()}
            players={session.playerPriorityOrder.map((playerId) => ({ playerId, name: session.getPlayerName(playerId) }))}
            appearances={session.mapView.stations} {view} {companyNames} />
    {:else}
        <div class="table-scroll">
        <table aria-label="Company share ownership" class:transposed={view === 'Player'}>
            <colgroup>
                <col class="label-column" />
                {#if view === 'Company'}
                    {#each owners as owner (owner.id)}
                        <col class:pool-section={owner.id in poolColumnLabels} />
                    {/each}
                    <col span="4" class="financial-section" />
                {:else}
                    {#each companies as company (company.id)}<col />{/each}
                    <col span={statisticLabels.length} class="financial-section" />
                {/if}
            </colgroup>
            <thead>
                <tr>
                    <th scope="col">{view}</th>
                    {#if view === 'Company'}
                        {#each owners as owner (owner.id)}<th
                                scope="col"
                                class:pool-start={owner.id === firstPoolId}
                                title={owner.name}>{poolColumnLabels[owner.id] ?? portfolioColumnLabels.get(owner.id) ?? owner.name}</th
                            >{/each}
                        <th scope="col" class="company-stat-start">Cash</th>
                        <th scope="col">Tokens</th>
                        <th scope="col">Trains</th>
                        <th scope="col" class="company-stat-start">Last run</th>
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
                        <tr class:active-row={row.company.id === operatingCompanyId}>
                            <th scope="row" aria-label={row.company.name}
                                >{@render companyLabel(row.company)}</th
                            >
                            {#each row.shares as shares, index}{@render shareCell(
                                    shares,
                                    owners[index].id === firstPoolId,
                                    row.presidentId === owners[index].id,
                                    !(owners[index].id in poolColumnLabels)
                                )}{/each}
                            <td class="company-stat-start">{@render companyCash(row.cash)}</td>
                            <td>{row.stations.filter((station) => station.status === 'available').length}/{row.stations.length}</td>
                            <td>{@render companyTrains(row.company.id)}</td>
                            <td class="company-stat-start">{@render lastRunCell(row.company)}</td>
                        </tr>
                    {/each}
                    {#each statisticLabels as label, index}
                        <tr class="financial-row" class:stat-start={index === 0}>
                            <th scope="row">{label}</th>
                            {#each owners as owner (owner.id)}
                                <td
                                    class:pool-start={owner.id === firstPoolId}
                                    class:empty={!statistics.has(owner.id)}
                                    >{statistics.get(owner.id)?.[index] ?? '—'}</td
                                >
                            {/each}
                            <td class="company-stat-start empty">—</td>
                            <td class="empty">—</td>
                            <td class="empty">—</td>
                            <td class="company-stat-start empty">—</td>
                        </tr>
                    {/each}
                {:else}
                    {#each owners as owner, index (owner.id)}
                        <tr class:pool-start={owner.id === firstPoolId} class:pool-row={owner.id in poolColumnLabels}>
                            <th scope="row" title={owner.name}>{portfolioColumnLabels.get(owner.id) ?? owner.name}</th>
                            {#each rows as row (row.company.id)}{@render shareCell(
                                    row.shares[index],
                                    false,
                                    row.presidentId === owner.id,
                                    !(owner.id in poolColumnLabels)
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
                    <tr class="company-stat-start financial-row">
                        <th scope="row">Cash</th>
                        {#each rows as row (row.company.id)}<td>{@render companyCash(row.cash)}</td
                            >{/each}
                        {#each statisticLabels as _, index}<td
                                class:stat-start={index === 0}
                                class="empty">—</td
                            >{/each}
                    </tr>
                    <tr class="financial-row">
                        <th scope="row">Tokens</th>
                        {#each rows as row (row.company.id)}
                            <td>{row.stations.filter((station) => station.status === 'available').length}/{row.stations.length}</td>
                        {/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="empty">—</td>{/each}
                    </tr>
                    <tr class="financial-row">
                        <th scope="row">Trains</th>
                        {#each rows as row (row.company.id)}<td>{@render companyTrains(row.company.id)}</td>{/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="empty">—</td>{/each}
                    </tr>
                    <tr class="company-stat-start financial-row">
                        <th scope="row">Last run</th>
                        {#each rows as row (row.company.id)}<td>{@render lastRunCell(row.company)}</td>{/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="empty">—</td>{/each}
                    </tr>
                {/if}
            </tbody>
        </table>
        </div>
    {/if}
</div>

<style>
    td + td.share-cell {
        border-left: 1px solid #6955401c;
    }
    .last-run {
        border: 0;
        border-radius: 4px;
        padding: 1px 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
    }
    .last-run:hover:enabled { background: #ffffff66; }
    .last-run:focus-visible { outline: 2px solid #9e7752; outline-offset: 1px; }
    .last-run:disabled { cursor: default; }

    .label-column {
        background: #69554008;
    }
    .pool-section,
    .pool-row {
        background: #69554012;
    }
    .financial-section,
    .financial-row {
        background: #6955400a;
    }
    .active-row {
        background: #e6cc9e;
    }
    .active-row > th {
        color: #493622;
        font-weight: 700;
    }
    thead {
        background: #69554012;
    }
    tbody tr:hover {
        background-color: #69554016;
    }
    tbody tr.active-row:hover {
        background-color: #dec18e;
    }

    .company-trains {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 3px;
    }
    .share-value {
        position: relative;
        display: inline-block;
    }
    .share-value.president {
        font-weight: 650;
    }
    .badge {
        position: absolute;
        --president-badge-background: #a79888;
        left: 100%;
        margin-left: -2px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
    }
    .toolbar {
        display: flex;
        gap: 12px;
        width: 100%;
    }
    .axis-toggle:not(.period-toggle) { margin-left: auto; }
    .table-scroll { overflow-x: auto; }
    .view-toggle {
        display: flex;
        width: max-content;
        border: 1px solid #c7b8a6;
        border-radius: 6px;
        overflow: hidden;
        margin-block: 4px;
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
    .axis-toggle {
        align-items: center;
        gap: 7px;
        border: 0;
        border-radius: 0;
        overflow: visible;
    }
    .axis-toggle button {
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 13px;
    }
    .axis-toggle button[aria-pressed='true'] {
        color: #443c34;
        font-weight: 700;
        background: #e5d7c3;
    }
    .axis-toggle button:hover { color: #443c34; }
    .axis-separator {
        height: 13px;
        border-left: 1px solid #b7a58f;
    }
    .transposed .company {
        justify-content: center;
    }
    .spreadsheet {
        container-type: inline-size;
        width: 100%;
        min-width: 0;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin: 2px 0 8px;
    }
    th,
    td {
        padding: 4px 9px;
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
        padding-left: 6px;
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
            padding-inline: 7px;
        }
    }
    @container (max-width: 560px) {
        th,
        td {
            padding-inline: 5px;
        }
    }
</style>
