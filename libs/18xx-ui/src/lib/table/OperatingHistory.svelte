<script lang="ts">
    import type { ValuationRules } from '@tabletop/18xx'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    import { operatingHistory } from './operatingHistory.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        session,
        valuationRules,
        view,
        companyNames
    }: {
        session: FinanceExampleSession
        valuationRules: ValuationRules
        view: 'Company' | 'Player'
        companyNames: Readonly<Record<string, CompanyNameVariants>>
    } = $props()
    const rounds = $derived.by(() => {
        const context = session.history.visibleContext
        return operatingHistory(context.state, context.actions, context.engine, valuationRules)
    })
    const companies = $derived([
        ...new Map(rounds.flatMap((round) => Object.entries(round.companyNames))).entries()
    ])
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
</script>

{#if rounds.length}
    <table aria-label="Operating round history">
        <thead>
            <tr>
                <th scope="col">{view}</th>
                {#each rounds as round (round.id)}
                    <th scope="colgroup" colspan={view === 'Player' ? 2 : 1}>
                        OR {round.id}
                        {#if !round.complete}<small>In progress</small>{/if}
                        {#if round.partial}<small>Partial</small>{/if}
                    </th>
                {/each}
            </tr>
            <tr class="metrics">
                <th></th>
                {#each rounds as round (round.id)}
                    <th scope="col">{view === 'Company' ? 'Train revenue' : 'Income'}</th>
                    {#if view === 'Player'}<th scope="col">Net worth</th>{/if}
                {/each}
            </tr>
        </thead>
        <tbody>
            {#if view === 'Player'}
                {#each session.playerPriorityOrder as playerId (playerId)}
                    <tr>
                        <th scope="row">{session.getPlayerName(playerId)}</th>
                        {#each rounds as round (round.id)}
                            <td>${money.format(round.playerIncome[playerId])}</td>
                            <td>${money.format(round.playerNetWorth[playerId])}</td>
                        {/each}
                    </tr>
                {/each}
            {:else}
                {#each companies as [companyId, name] (companyId)}
                    <tr>
                        <th scope="row" aria-label={name}
                            ><span class="company">
                                {#if session.mapView.stations[companyId]}<CompanyToken
                                        appearance={session.mapView.stations[companyId]}
                                        size={22}
                                    />{/if}
                                <span title={name}>{companyNames[companyId]?.initials ?? companyId}</span>
                            </span></th
                        >
                        {#each rounds as round (round.id)}
                            <td
                                >{round.companyIncome[companyId] === undefined
                                    ? '—'
                                    : `$${money.format(round.companyIncome[companyId])}`}</td
                            >
                        {/each}
                    </tr>
                {/each}
            {/if}
        </tbody>
    </table>
    <p>
        Player income includes dividends and private income. Net worth is measured at OR end, or at
        the current point for an unfinished OR.
    </p>
    {#if rounds.some((round) => round.partial)}<p>
            Partial rounds include only recorded income; earlier actions are unavailable in this
            prepared position.
        </p>{/if}
{:else}
    <p>No operating-round history recorded yet.</p>
{/if}

<style>
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
        white-space: nowrap;
    }
    th {
        font-weight: 500;
    }
    thead th {
        color: #786550;
        font-size: 12px;
    }
    th:first-child {
        text-align: left;
        padding-left: 0;
    }
    td {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    small {
        display: block;
        font-size: 10px;
        font-weight: 400;
        color: #938371;
    }
    p {
        font-size: 11px;
        color: #8b7b6b;
        margin: 8px 0;
    }
</style>
