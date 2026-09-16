<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    import type { OperatingRoundHistory } from './operatingHistory.js'
    import SpreadsheetPlayerName from './SpreadsheetPlayerName.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        rounds,
        players,
        appearances,
        view,
        companyNames,
        onPreviewMap
    }: {
        onPreviewMap: (action: GameAction) => void
        rounds: OperatingRoundHistory[]
        players: { playerId: string; name: string; color: string }[]
        appearances: Readonly<Record<string, StationAppearance>>
        view: 'Company' | 'Player'
        companyNames: Readonly<Record<string, CompanyNameVariants>>
    } = $props()
    const companies = $derived([
        ...new Map(rounds.flatMap((round) => Object.entries(round.companyNames))).entries()
    ])
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
</script>

{#if rounds.length}
    <div class="table-scroll">
    <table aria-label="Operating round history">
        <colgroup>
            <col class="round-column" />
            {#if view === 'Player'}
                {#each players as player, index (player.playerId)}<col span="3" class="data-column" class:shaded={index % 2 === 1} />{/each}
            {:else}
                {#each companies as [companyId], index (companyId)}<col class="data-column" class:shaded={index % 2 === 1} />{/each}
            {/if}
        </colgroup>
        <thead>
            <tr>
                <th scope="col" rowspan={view === 'Player' ? 2 : 1}>Round</th>
                {#if view === 'Player'}
                    {#each players as player (player.playerId)}
                        <th scope="colgroup" colspan="3" title={player.name}><SpreadsheetPlayerName name={player.name} color={player.color} /></th>
                    {/each}
                {:else}
                    {#each companies as [companyId, name] (companyId)}
                        <th scope="col" aria-label={name}>
                            <span class="company">
                                {#if appearances[companyId]}<CompanyToken appearance={appearances[companyId]} size={22} />{/if}
                                <span title={name}>{companyNames[companyId]?.initials ?? companyId}</span>
                            </span>
                        </th>
                    {/each}
                {/if}
            </tr>
            {#if view === 'Player'}
                <tr class="metrics">
                    {#each players as player (player.playerId)}
                        <th scope="col">Income</th>
                        <th scope="col">Net worth</th>
                        <th scope="col" aria-label="Net worth change from previous OR">Δ</th>
                    {/each}
                </tr>
            {/if}
        </thead>
        <tbody>
            {#each rounds as round, roundIndex (round.id)}
                <tr>
                    <th scope="row">
                        OR {round.id}
                        {#if !round.complete || round.partial}<sup>*</sup>{/if}
                    </th>
                    {#if view === 'Player'}
                        {#each players as player (player.playerId)}
                            <td>${money.format(round.playerIncome[player.playerId] ?? 0)}</td>
                            <td>{round.playerNetWorth[player.playerId] === undefined ? '—' : `$${money.format(round.playerNetWorth[player.playerId])}`}</td>
                            <td>
                                {#if roundIndex > 0 && round.playerNetWorth[player.playerId] !== undefined && rounds[roundIndex - 1].playerNetWorth[player.playerId] !== undefined}
                                    {@const delta = round.playerNetWorth[player.playerId] - rounds[roundIndex - 1].playerNetWorth[player.playerId]}
                                    <span class:negative={delta < 0}>${money.format(Math.abs(delta))}</span>
                                {:else}—{/if}
                            </td>
                        {/each}
                    {:else}
                        {#each companies as [companyId] (companyId)}
                            {@const run = round.companyRuns[companyId]}
                            <td class:negative={round.withheldCompanyIds.includes(companyId)}>
                                {#if round.companyIncome[companyId] === undefined}—
                                {:else if run && round.companyIncome[companyId] > 0}<button class="payout" onclick={() => onPreviewMap(run)}
                                    aria-label={`Show ${round.companyNames[companyId]} run in OR ${round.id}`}
                                    >${money.format(round.companyIncome[companyId])}</button>
                                {:else}${money.format(round.companyIncome[companyId])}{/if}
                            </td>
                        {/each}
                    {/if}
                </tr>
            {/each}
        </tbody>
    </table>
    </div>
    {#if view === 'Player'}<p>
        Player income includes dividends and private income. Net worth is recorded at OR end; unfinished rounds show the latest snapshot from the round’s start or a completed company turn.
    </p>{/if}
    {#if rounds.some((round) => !round.complete || round.partial)}<p>
            * Incomplete round: still in progress or only partially recorded. Values include recorded
            income only.{#if view === 'Player'} Net worth reflects the latest recorded snapshot in that round.{/if}
        </p>{/if}
{:else}
    <p>No operating-round history recorded yet.</p>
{/if}

<style>
    .payout { border: 0; border-radius: 4px; padding: 1px 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .payout:hover { background: #69554016; }
    .payout:focus-visible { outline: 2px solid #9e7752; outline-offset: 1px; }
    .negative { color: #b33a32; }
    .table-scroll { overflow-x: auto; }
    table {
        width: auto;
        border-collapse: collapse;
        font-size: 13px;
        margin: 0 0 8px;
    }
    th,
    td {
        padding: 4px 13px;
        border-bottom: 1px solid #d2c5b7;
        white-space: nowrap;
    }
    th {
        font-weight: 500;
    }
    thead th {
        color: #786550;
        font-size: 12px;
    }
    th[scope="row"],
    th[rowspan] {
        text-align: left;
        padding-left: 12px;
    }
    td {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .company {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    sup { font-size: 10px; margin-left: 2px; }
    .round-column { background: #69554008; }
    .data-column { background: #faf6ee; }
    .shaded { background: #f0e7d9; }
    thead { background: #69554012; }
    .metrics { background: #69554008; }
    tbody tr:hover { background-color: #69554016; }
    p {
        font-size: 11px;
        color: #8b7b6b;
        margin: 8px 0;
    }
</style>
