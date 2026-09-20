<script lang="ts">
    import './playerTint.css'
    import { companySharePrice, DefaultCompanyPricePresentation, type CompanyPricePresentation } from './companyPresentation.js'
    import type { GameAction } from '@tabletop/common'
    import { companyLastRun } from './companyLastRun.js'
    import {
        cashOwnedBy,
        nextOperatingCompany,
        certificatesInPool,
        controllingOwner,
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
    import PlayerName from './PlayerName.svelte'
    import OperatingHistory from './OperatingHistory.svelte'
    import { spreadsheetCompanies } from './spreadsheetCompanies.js'
    import SpreadsheetOutline from './SpreadsheetOutline.svelte'

    let ownershipTable: HTMLTableElement | undefined = $state()
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'

    let {
        session,
        pricePresentation = DefaultCompanyPricePresentation,
        fillWidth = false,
        onPreviewMap,
        companyOrder,
        marketPoolId,
        exchangePoolId,
        valuationRules,
        trainColors,
        companyNames = {},
        includedPortfolioCompanyIds = [],
        portfolioCompanyIds = []
    }: {
        pricePresentation?: CompanyPricePresentation
        fillWidth?: boolean
        companyOrder?: readonly string[]
        onPreviewMap: (action: GameAction) => void
        session: FinanceExampleSession
        marketPoolId: string
        exchangePoolId?: string
        trainColors: Readonly<Record<string, string>>
        valuationRules: ValuationRules
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        portfolioCompanyIds?: readonly string[]
        includedPortfolioCompanyIds?: readonly string[]
    } = $props()
    const operatingCompanyId = $derived(
        session.financialState.stockRound.completed && session.financialState.operatingSet && !session.financialState.result
            ? nextOperatingCompany(session.financialState) : undefined
    )
    const currentPlayerOwners = $derived(new Set(
        operatingCompanyId ? [] : session.financialState.activePlayerIds.map((id) => `player:${id}`)
    ))
    const companies = $derived(spreadsheetCompanies(
        session.financialState, session.actions, session.gameState.actionCount, companyOrder
    ))
    const periods = ['Current', 'Player income', 'Company payouts'] as const
    let period = $state<(typeof periods)[number]>('Current')
    let scrolled = $state(false)
    const view = $derived(session.preferences.values.spreadsheetView === 'company' ? 'Company' : 'Player')
    function soldThisRound(ownerId: string, companyId: string): boolean {
        const state = session.financialState
        return state.machineState === 'StockRound' && !state.stockRound.completed &&
            state.stockRound.sales.some((sale) => sale.companyId === companyId &&
                (sale.owner.kind === 'player' ? `player:${sale.owner.playerId}` :
                    sale.owner.kind === 'company' ? `company:${sale.owner.companyId}` : 'bank') === ownerId)
    }
    const firstPoolId = 'market'
    const poolColumnLabels: Readonly<Record<string, string>> = { market: 'Market', treasury: 'Treas.', exchange: 'Exch.' }
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
    const portfolioOwners = $derived(portfolioCompanyIds.map((ownerId) => ({
            id: `company:${ownerId}`,
            name: getCompany(session.financialState, ownerId).name,
            controllerId: controllingOwner(session.financialState, ownerId)?.playerId,
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, {
                    kind: 'company',
                    companyId: ownerId
                })
        })))
    const owners = $derived([
        ...session.playerPriorityOrder.flatMap((playerId) => [{
            id: `player:${playerId}`,
            name: session.getPlayerName(playerId),
            count: (companyId: string) =>
                sharesOwned(session.financialState, companyId, { kind: 'player', playerId })
        }, ...portfolioOwners.filter((owner) => owner.controllerId === playerId)]),
        ...portfolioOwners.filter((owner) => !owner.controllerId),
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
    ].filter((owner) => (owner.id !== 'exchange' && owner.id !== 'treasury') || companies.some((company) => owner.count(company.id) > 0)))
    const includedPortfolioOwners = $derived(portfolioOwners.filter((owner) =>
        owner.controllerId && includedPortfolioCompanyIds.some((id) => owner.id === `company:${id}`)))
    const footnoteId = $props.id()
    const ownerConnections = $derived(owners.map((owner, index) => {
        const controllerId = portfolioOwners.find((entry) => entry.id === owner.id)?.controllerId
        const nextControllerId = portfolioOwners.find((entry) => entry.id === owners[index + 1]?.id)?.controllerId
        return {
            controlled: !!controllerId,
            continues: !!nextControllerId && (nextControllerId === controllerId || owner.id === `player:${nextControllerId}`)
        }
    }))
    const rows = $derived(
        companies.map((company) => ({
            company,
            value: companySharePrice(session.financialState.stockMarket, company.id),
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
    function ownerPlayerColor(ownerId: string) {
        return ownerId.startsWith('player:') ? session.colors.getPlayerBgColorValue(ownerId.slice(7)) : undefined
    }
    function poolAlternate(ownerId: string) {
        return owners.filter((owner) => owner.id in poolColumnLabels).findIndex((owner) => owner.id === ownerId) % 2 === 1
    }
    function ownerTintColor(ownerId: string) {
        const controllerId = portfolioOwners.find((entry) => entry.id === ownerId)?.controllerId
        return ownerPlayerColor(ownerId) ?? (controllerId ? session.colors.getPlayerBgColorValue(controllerId) : undefined)
    }
</script>

{#snippet financialValue(ownerId: string, index: number)}
    {@const included = statisticLabels[index] === 'Net worth' && includedPortfolioOwners.some((owner) => owner.id === ownerId)}
    <span class:included-net-worth={included} aria-describedby={included ? `${footnoteId}-${ownerId}` : undefined}>{statistics.get(ownerId)?.[index] ?? '—'}{#if included}<sup>*</sup>{/if}</span>
{/snippet}

{#snippet ownerLabel(owner: { id: string; name: string }, column = false)}
    {@const color = ownerPlayerColor(owner.id)}
    {#if color}
        <PlayerName name={owner.name} {color} dot={false} />
    {:else if portfolioColumnLabels.has(owner.id)}
        <span class="owner-name portfolio-full">{owner.name}</span>
        <span class="owner-name portfolio-short">{portfolioColumnLabels.get(owner.id)}</span>
    {:else}<span class="owner-name">{column ? poolColumnLabels[owner.id] ?? owner.name : owner.name}</span>{/if}
{/snippet}

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

{#snippet shareCell(shares: number, poolStart = false, president = false, matrix = true, sold = false, operating = false, tint: string | undefined = undefined, poolAlt = false)}
    <td class:operating-column={operating} class:sold class:share-cell={matrix} class:available-pool={!matrix} class:pool-alt={poolAlt} class:empty={shares === 0} class:pool-start={poolStart}
        class:player-tinted-cell={!!tint} style:--player-color={tint}>
        <span class="share-value" class:president
            >{shares === 0 ? '' : shares}{#if president}<span class="badge" aria-label="President">P</span>{/if}</span
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

<div class="spreadsheet" class:fill-width={fillWidth}>
    <div class="toolbar" role="group" aria-label="Spreadsheet controls">
        <div class="view-toggle axis-toggle period-toggle" role="group" aria-label="Spreadsheet period" style:--segments={periods.length} style:--selected={periods.indexOf(period)}>
            <span class="thumb" aria-hidden="true"></span>
            {#each periods as option}
                <button aria-pressed={period === option} onclick={() => period = option}>{option === 'Player income' ? 'Income' : option === 'Company payouts' ? 'Payouts' : option}</button>
            {/each}
        </div>
        {#if period === 'Current'}<div class="view-toggle axis-toggle" role="group" aria-label="Spreadsheet view">
            <button
                class="swap-axes"
                aria-label="Swap rows and columns"
                title={view === 'Company' ? 'Show players as rows' : 'Show companies as rows'}
                onclick={() => session.preferences.set({ spreadsheetView: view === 'Company' ? 'player' : 'company' }, 'family')}
                >X ↔ Y</button
            >
        </div>{/if}
    </div>
    <div class="sheet-spacing" aria-hidden="true"></div>
    <div class="sheet-content">
    {#if period !== 'Current'}
        <OperatingHistory rounds={session.operatingIncomeHistory()}
            players={session.playerPriorityOrder.map((playerId) => ({ playerId, name: session.getPlayerName(playerId), color: session.colors.getPlayerBgColorValue(playerId) }))}
            appearances={session.mapView.stations} view={period === 'Player income' ? 'Player' : 'Company'} {companyNames} {onPreviewMap} />
    {:else}
        <div class="table-scroll" class:scrolled onscroll={(event) => scrolled = event.currentTarget.scrollLeft > 0}>
        <div class="outlined-table">
        <table bind:this={ownershipTable} aria-label="Company share ownership" class:transposed={view === 'Player'}>
            <colgroup>
                <col class="label-column" />
                {#if view === 'Company'}
                    {#each owners as owner (owner.id)}
                        <col class:pool-section={owner.id in poolColumnLabels} />
                    {/each}
                    <col span={pricePresentation.showInSpreadsheet ? 5 : 4} class="financial-section" />
                {:else}
                    {#each companies as company (company.id)}<col />{/each}
                    <col span={statisticLabels.length} class="financial-section" />
                {/if}
            </colgroup>
            <thead>
                <tr>
                    <th scope="col">{view}</th>
                    {#if view === 'Company'}
                        {#each owners as owner, index (owner.id)}<th
                                scope="col"
                                class:pool-start={owner.id === firstPoolId}
                                class:current-player-column={currentPlayerOwners.has(owner.id)}
                                class:player-tinted-header={!!ownerTintColor(owner.id)}
                                class:controlled-tint={!ownerPlayerColor(owner.id)}
                                style:--player-color={ownerTintColor(owner.id)}
                                title={owner.name}><span class="column-owner-label">
                                    {#if ownerConnections[index].controlled}<span class="column-ownership-connector incoming" aria-hidden="true"></span>{/if}
                                    {@render ownerLabel(owner, true)}
                                    {#if ownerConnections[index].continues}<span class="column-ownership-connector outgoing" aria-hidden="true"></span>{/if}
                                </span></th
                            >{/each}
                        {#if pricePresentation.showInSpreadsheet}<th scope="col" class="company-stat-start">{pricePresentation.label}</th>{/if}
                        <th scope="col" class="company-stat-start">Cash</th>
                        <th scope="col">Trains</th>
                        <th scope="col">Tokens</th>
                        <th scope="col" class="company-stat-start">Last run</th>
                    {:else}
                        {#each companies as company (company.id)}
                            <th scope="col" class:operating-column={company.id === operatingCompanyId} aria-label={company.name}
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
                        <tr class:operating-company={row.company.id === operatingCompanyId}>
                            <th scope="row" aria-label={row.company.name}
                                >{@render companyLabel(row.company)}</th
                            >
                            {#each row.shares as shares, index}{@render shareCell(
                                    shares,
                                    owners[index].id === firstPoolId,
                                    row.presidentId === owners[index].id,
                                    !(owners[index].id in poolColumnLabels),
                                    soldThisRound(owners[index].id, row.company.id),
                                    false,
                                    ownerTintColor(owners[index].id),
                                    poolAlternate(owners[index].id)
                                )}{/each}
                            {#if pricePresentation.showInSpreadsheet}<td class="company-stat-start bright-cell value-cell">{row.value === undefined ? '—' : money.format(row.value)}</td>{/if}
                            <td class="company-stat-start bright-cell">{@render companyCash(row.cash)}</td>
                            <td class="bright-cell">{@render companyTrains(row.company.id)}</td>
                            <td class="bright-cell token-cell">{row.stations.filter((station) => station.status === 'available').length}/{row.stations.length}</td>
                            <td class="company-stat-start">{@render lastRunCell(row.company)}</td>
                        </tr>
                    {/each}
                    {#each statisticLabels as label, index}
                        <tr class="financial-row" class:stat-start={index === 0}>
                            <th scope="row">{label}</th>
                            {#each owners as owner (owner.id)}
                                <td
                                    class:pool-start={owner.id === firstPoolId}
                                    class:bright-cell={statistics.has(owner.id)}
                                    class:player-financial={!!ownerTintColor(owner.id)}
                                    style:--player-color={ownerTintColor(owner.id)}
                                    class:token-cell={label === 'Shares' && statistics.has(owner.id)}
                                    class:empty={!statistics.has(owner.id)}
                                    class:void={owner.id in poolColumnLabels}
                                    >{#if !(owner.id in poolColumnLabels)}{@render financialValue(owner.id, index)}{/if}</td
                                >
                            {/each}
                            {#each { length: pricePresentation.showInSpreadsheet ? 5 : 4 } as _, column}<td class="void"></td>{/each}
                        </tr>
                    {/each}
                {:else}
                    {#each owners as owner, index (owner.id)}
                        <tr class:current-player={currentPlayerOwners.has(owner.id)} class:pool-start={owner.id === firstPoolId} class:pool-row={owner.id in poolColumnLabels}>
                            <th scope="row" title={owner.name}
                                class:non-player-owner={!owner.id.startsWith('player:')}
                                class:player-tinted-header={!!ownerTintColor(owner.id)}
                                class:controlled-tint={!ownerPlayerColor(owner.id)}
                                style:--player-color={ownerTintColor(owner.id)}
                                class:controlled-owner={ownerConnections[index].controlled}
                                class:ownership-continues={ownerConnections[index].continues}>{@render ownerLabel(owner)}</th>
                            {#each rows as row (row.company.id)}{@render shareCell(
                                    row.shares[index],
                                    false,
                                    row.presidentId === owner.id,
                                    !(owner.id in poolColumnLabels),
                                    soldThisRound(owner.id, row.company.id),
                                    row.company.id === operatingCompanyId,
                                    ownerTintColor(owner.id),
                                    poolAlternate(owner.id)
                                )}{/each}
                            {#each statisticLabels as _, statIndex}
                                <td
                                    class:stat-start={statIndex === 0}
                                    class:bright-cell={statistics.has(owner.id)}
                                    class:player-financial={!!ownerTintColor(owner.id)}
                                    style:--player-color={ownerTintColor(owner.id)}
                                    class:token-cell={statisticLabels[statIndex] === 'Shares' && statistics.has(owner.id)}
                                    class:empty={!statistics.has(owner.id)}
                                    class:void={owner.id in poolColumnLabels}
                                    >{#if !(owner.id in poolColumnLabels)}{@render financialValue(owner.id, statIndex)}{/if}</td
                                >
                            {/each}
                        </tr>
                    {/each}
                    {#if pricePresentation.showInSpreadsheet}
                        <tr class="company-stat-start financial-row">
                            <th scope="row">{pricePresentation.label}</th>
                            {#each rows as row (row.company.id)}<td class:operating-column={row.company.id === operatingCompanyId} class="bright-cell value-cell">{row.value === undefined ? '—' : money.format(row.value)}</td>{/each}
                            {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="void"></td>{/each}
                        </tr>
                    {/if}
                    <tr class="company-stat-start financial-row">
                        <th scope="row">Cash</th>
                        {#each rows as row (row.company.id)}<td class:operating-column={row.company.id === operatingCompanyId} class="bright-cell">{@render companyCash(row.cash)}</td
                            >{/each}
                        {#each statisticLabels as _, index}<td
                                class:stat-start={index === 0}
                                class="void"></td
                            >{/each}
                    </tr>
                    <tr class="financial-row">
                        <th scope="row">Trains</th>
                        {#each rows as row (row.company.id)}<td class:operating-column={row.company.id === operatingCompanyId} class="bright-cell">{@render companyTrains(row.company.id)}</td>{/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="void"></td>{/each}
                    </tr>
                    <tr class="financial-row">
                        <th scope="row">Tokens</th>
                        {#each rows as row (row.company.id)}
                            <td class:operating-column={row.company.id === operatingCompanyId} class="bright-cell token-cell">{row.stations.filter((station) => station.status === 'available').length}/{row.stations.length}</td>
                        {/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="void"></td>{/each}
                    </tr>
                    <tr class="company-stat-start financial-row">
                        <th scope="row">Last run</th>
                        {#each rows as row (row.company.id)}<td class:operating-column={row.company.id === operatingCompanyId}>{@render lastRunCell(row.company)}</td>{/each}
                        {#each statisticLabels as _, index}<td class:stat-start={index === 0} class="void"></td>{/each}
                    </tr>
                {/if}
            </tbody>
        </table>
        <SpreadsheetOutline table={ownershipTable} />
        </div>
        </div>
        {#each includedPortfolioOwners as owner (owner.id)}
            <p class="wealth-footnote" id={`${footnoteId}-${owner.id}`}>* {owner.name}'s net worth is included in its controlling player's net worth.</p>
        {/each}
    {/if}
    </div>
</div>

<style>
    .included-net-worth { color: var(--rail-muted, #998b79); }
    .included-net-worth sup { font-size: 9px; margin-left: 1px; }
    .wealth-footnote { margin: 4px 0 8px; padding-inline: 6px; color: var(--rail-muted, #887969); font-size: 11px; }
    .owner-name {
        display: inline-block;
        vertical-align: middle;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .portfolio-short { display: none; }
    table {
        --sheet-cell: var(--rail-surface, #222c37);
        --sheet-label: var(--rail-surface-raised, #2b3744);
        --sheet-pool: var(--sheet-cell);
        --sheet-market: #1b3d45;
        --sheet-financial: #1b232d;
        --sheet-sold: #4a2a33;
        --sheet-rule: #2f3b48;
        --sheet-divider: #5b6d80;
    }
    .share-cell { --cell-fill: var(--sheet-cell); }
    .available-pool { --cell-fill: var(--sheet-pool); }
    td.available-pool.pool-alt { --cell-fill: color-mix(in srgb, #ffffff 3%, var(--sheet-pool)); }
    .pool-row { --row-fill: var(--sheet-pool); }
    .financial-row { --row-fill: var(--sheet-financial); }
    .bright-cell,
    td:has(.last-run) { --cell-fill: var(--sheet-financial); }
    td.player-tinted-cell,
    td.player-financial { --cell-fill: color-mix(in srgb, var(--player-color) 15%, var(--sheet-cell)); }
    td.sold { --cell-fill: var(--sheet-sold); }
    td.value-cell { --cell-fill: color-mix(in srgb, var(--sheet-market) 45%, var(--sheet-cell)); }
    td { background: var(--cell-fill, var(--row-fill, transparent)); }
    tbody tr:hover td {
        background: color-mix(in srgb, var(--rail-text, #e3e9ef) 9%, var(--cell-fill, var(--row-fill, var(--sheet-cell))));
    }
    tbody tr:hover th {
        background: color-mix(in srgb, var(--rail-text, #e3e9ef) 9%, var(--player-tinted-background, var(--sheet-label)));
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
    .last-run:hover:enabled { background: var(--rail-hover, #ffffff66); }
    .last-run:focus-visible { outline: 2px solid var(--rail-focus, #9e7752); outline-offset: 1px; }
    .last-run:disabled { cursor: default; }

    thead th,
    tbody th {
        background: var(--sheet-label);
    }
    th.player-tinted-header {
        background: var(--player-tinted-background);
    }
    tbody th.player-tinted-header { box-shadow: inset 3px 0 0 var(--player-color); }
    thead th.player-tinted-header { box-shadow: inset 0 3px 0 var(--player-color); }
    th.player-tinted-header.controlled-tint { box-shadow: none; }

    .company-trains {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 3px;
    }
    .share-value {
        position: relative;
        display: inline-block;
        text-box: trim-both cap alphabetic;
    }
    .share-value.president {
        font-weight: 650;
    }
    .badge {
        position: absolute;
        color: var(--rail-muted, #a79888);
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        left: 100%;
        margin-left: 2px;
        top: 0;
        text-box: trim-both cap alphabetic;
    }
    .sheet-spacing { flex: 0 1 20px; min-height: 0; }
    .sheet-content { flex-shrink: 0; width: fit-content; max-width: 100%; margin-inline: auto; }
    .fill-width .sheet-spacing { display: none; }
    .fill-width .sheet-content { width: 100%; }
    .fill-width .sheet-content :global(table) { width: 100%; }
    .toolbar {
        display: flex;
        flex-shrink: 0;
        justify-content: center;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding-block: 8px;
        background: var(--rail-table-background, #18212b);
    }
    .table-scroll { overflow-x: auto; }
    .outlined-table { position: relative; }
    .view-toggle {
        display: flex;
        align-items: center;
        width: max-content;
        gap: 2px;
        padding: 2px;
        border-radius: 999px;
        background: var(--rail-surface, #222c37);
        margin: 0;
    }
    .view-toggle button {
        border: 0;
        border-radius: 999px;
        padding: 3px 12px;
        font: inherit;
        font-size: 12px;
        line-height: 16px;
        color: var(--rail-muted, #7f8e9e);
        background: transparent;
        cursor: pointer;
        white-space: nowrap;
    }
    .view-toggle button:hover { color: var(--rail-text, #e3e9ef); }
    .view-toggle button[aria-pressed='true'] {
        background: var(--rail-solid, #40576b);
        color: #ffffff;
        font-weight: 600;
    }
    .period-toggle { position: relative; display: grid; grid-template-columns: repeat(var(--segments), minmax(0, 1fr)); gap: 0; }
    .period-toggle button {
        position: relative;
        transition: color 180ms ease;
    }
    .period-toggle button[aria-pressed='true'] { background: transparent; }
    .period-toggle .thumb {
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: 2px;
        width: calc((100% - 4px) / var(--segments));
        border-radius: 999px;
        background: var(--rail-solid, #40576b);
        transform: translateX(calc(var(--selected) * 100%));
        transition: transform 180ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
        .period-toggle button,
        .period-toggle .thumb { transition: none; }
    }
    .view-toggle button:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .swap-axes { color: var(--rail-text, #e3e9ef); }
    .transposed .company {
        justify-content: center;
    }
    .spreadsheet {
        display: flex;
        flex-direction: column;
        height: 100%;
        container-type: inline-size;
        width: 100%;
        min-width: 0;
    }
    table {
        --cell-padding-inline: 13px;
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin: 0 0 8px;
    }
    th,
    td {
        padding: 4px 13px;
        border-bottom: 1px solid var(--sheet-rule);
    }
    /* :where() keeps these rules below the section dividers in specificity. */
    tr > :where(* + *:not(.void)) {
        border-left: 1px solid #ffffff10;
    }
    thead th:has(> .column-owner-label > .incoming) { border-left: 0; }
    thead th {
        white-space: nowrap;
        font-size: 12px;
        color: var(--rail-text, #e3e9ef);
        font-weight: 600;
        border-bottom: 2px solid var(--sheet-divider);
    }
    th:first-child {
        text-align: left;
        padding-left: 12px;
    }
    tr > th:first-child {
        position: sticky;
        left: 0;
        z-index: 1;
        border-right: 2px solid var(--sheet-divider);
    }
    .scrolled tr > th:first-child { z-index: 3; }
    tbody th {
        font-weight: 500;
    }
    th.non-player-owner,
    .financial-row > th {
        text-align: right;
    }
    tbody th.controlled-owner { text-align: left; }
    th.controlled-owner { padding-left: 36px; }
    .controlled-owner::before {
        content: '';
        position: absolute;
        left: 19px;
        top: -1px;
        height: calc(50% + 1px);
        width: 12px;
        border-left: 1px solid var(--rail-border, #b7a58f);
        border-bottom: 1px solid var(--rail-border, #b7a58f);
        pointer-events: none;
    }
    .ownership-continues::after {
        content: '';
        position: absolute;
        left: 19px;
        top: calc(50% + 7px);
        bottom: -1px;
        border-left: 1px solid var(--rail-border, #b7a58f);
        pointer-events: none;
    }
    .controlled-owner.ownership-continues::after { top: 50%; }
    .column-owner-label { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 20px; }
    .column-ownership-connector { flex: 1; min-width: 12px; border-top: 1px solid var(--rail-border, #b7a58f); }
    .column-ownership-connector.incoming { margin-left: calc(-1 * var(--cell-padding-inline)); }
    .column-ownership-connector.outgoing { margin-right: calc(-1 * var(--cell-padding-inline)); }
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
        border-top: 2px solid var(--sheet-divider);
    }
    .transposed .stat-start {
        border-left: 2px solid var(--sheet-divider);
    }
    table:not(.transposed) .pool-start,
    table:not(.transposed) .company-stat-start {
        border-left: 2px solid var(--sheet-divider);
    }
    .transposed tr.pool-start > th,
    .transposed tr.pool-start > td {
        border-top: 2px solid var(--sheet-divider);
    }
    .transposed tr.company-stat-start > th,
    .transposed tr.company-stat-start > td {
        border-top: 2px solid var(--sheet-divider);
    }
    .empty {
        color: var(--rail-muted, #a79888);
    }
    td.void {
        background: var(--rail-table-background, #18212b);
        border: 0;
    }
    tbody tr:hover td.void { background: var(--rail-table-background, #18212b); }
    .transposed tr.company-stat-start > td.void { border-top: 0; }
    tr.stat-start > td.void { border-top: 2px solid var(--sheet-divider); }
    @container (max-width: 800px) {
        table { --cell-padding-inline: 7px; }
        th,
        td {
            padding-inline: 7px;
        }
    }
    @container (max-width: 560px) {
        table { --cell-padding-inline: 5px; }
        .portfolio-full { display: none; }
        .portfolio-short { display: block; }
        th,
        td {
            padding-inline: 5px;
        }
    }
</style>
