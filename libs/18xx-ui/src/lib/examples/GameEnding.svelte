<script lang="ts">
    import type { FinanceExampleState } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, position }: { session: FinanceExampleSession; position?: FinanceExampleState } = $props()
    const state = $derived(position ?? session.financialState)
    const standings = $derived(state.finalWealth?.toSorted((a, b) => b.total - a.total) ?? [])
    const winners = $derived(state.winningPlayerIds.map((id) => session.getPlayerName(id)).join(' & '))
</script>

{#if state.gameEnding}
    <section aria-label="Game ending">
        <div class="results">
            <header>
                <p class="eyebrow">{state.finalWealth ? 'Final results' : 'Game ending'}</p>
                {#if state.finalWealth}<h2>{winners} {state.winningPlayerIds.length > 1 ? 'tie' : 'wins'}</h2>{/if}
                <p class="reason">{state.gameEnding.reason}{#if !state.finalWealth && state.gameEnding.finalOperatingSet !== undefined} · Ends after operating set {state.gameEnding.finalOperatingSet}{/if}</p>
            </header>
            {#if state.finalWealth}
                <table aria-label="Final wealth">
                    <thead><tr><th scope="col">Player</th><th scope="col">Final wealth</th></tr></thead>
                    <tbody>
                        {#each standings as player}
                            <tr class:winner={state.winningPlayerIds.includes(player.playerId)}>
                                <th scope="row"><span class="rank">{standings.findIndex((entry) => entry.total === player.total) + 1}</span>{session.getPlayerName(player.playerId)}</th>
                                <td>${player.total.toLocaleString('en-US')}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </section>
{/if}

<style>
    .results { width: min(100%, 440px); margin: 0 auto; color: #514536; }
    header { text-align: center; margin-bottom: 10px; }
    .eyebrow, thead th { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; font-weight: 400; color: #887969; }
    .eyebrow { margin: 0 0 3px; }
    .results header h2 { margin: 0; font-size: 22px; font-weight: 600; color: #443c34; }
    .reason { margin: 3px 0 0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 5px 8px; text-align: left; }
    thead { border-bottom: 1px solid #cbbcad; }
    tbody th { font-weight: 400; overflow-wrap: anywhere; }
    td, thead th:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .rank { display: inline-block; width: 22px; color: #887969; font-size: 11px; font-weight: 400; }
    .winner { background: #e9dfd2; color: #443c34; }
    .winner th, .winner td { font-weight: 600; }
</style>
