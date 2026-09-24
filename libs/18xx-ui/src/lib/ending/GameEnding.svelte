<script lang="ts">
    import type { EighteenXXState } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, position }: { session: EighteenXXSession; position?: EighteenXXState } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(position ?? session.gameState)
    const standings = $derived(gameState.finalWealth?.toSorted((a, b) => b.total - a.total) ?? [])
    const winners = $derived(
        gameState.winningPlayerIds.map((id) => session.getPlayerName(id)).join(' & ')
    )
</script>

{#if gameState.gameEnding}
    <section aria-label="Game ending">
        <div class="results">
            <header>
                <p class="eyebrow">{gameState.finalWealth ? 'Final results' : 'Game ending'}</p>
                {#if gameState.finalWealth}<h2>
                        {winners}
                        {gameState.winningPlayerIds.length > 1 ? 'tie' : 'wins'}
                    </h2>{/if}
                <p class="reason">
                    {gameState.gameEnding
                        .reason}{#if !gameState.finalWealth && gameState.gameEnding.finalOperatingSet !== undefined}
                        · Ends after operating set {gameState.gameEnding.finalOperatingSet}{/if}
                </p>
            </header>
            {#if gameState.finalWealth}
                <table aria-label="Final wealth">
                    <thead
                        ><tr><th scope="col">Player</th><th scope="col">Final wealth</th></tr
                        ></thead
                    >
                    <tbody>
                        {#each standings as player (player.playerId)}
                            <tr class:winner={gameState.winningPlayerIds.includes(player.playerId)}>
                                <th scope="row"
                                    ><span class="rank"
                                        >{standings.findIndex(
                                            (entry) => entry.total === player.total
                                        ) + 1}</span
                                    >{session.getPlayerName(player.playerId)}</th
                                >
                                <td>{money(player.total)}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </section>
{/if}

<style>
    .results {
        width: min(100%, 440px);
        margin: 0 auto;
        color: var(--rail-text, #514536);
    }
    header {
        text-align: center;
        margin-bottom: 10px;
    }
    .eyebrow,
    thead th {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 400;
        color: var(--rail-muted, #887969);
    }
    .eyebrow {
        margin: 0 0 3px;
    }
    .results header h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
        color: var(--rail-text, #443c34);
    }
    .reason {
        margin: 3px 0 0;
        font-size: 11px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    th,
    td {
        padding: 5px 8px;
        text-align: left;
    }
    thead {
        border-bottom: 1px solid var(--rail-border, #cbbcad);
    }
    tbody th {
        font-weight: 400;
        overflow-wrap: anywhere;
    }
    td,
    thead th:last-child {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    .rank {
        display: inline-block;
        width: 22px;
        color: var(--rail-muted, #887969);
        font-size: 11px;
        font-weight: 400;
    }
    .winner {
        background: var(--rail-surface-raised, #e9dfd2);
        color: var(--rail-text, #443c34);
    }
    .winner th,
    .winner td {
        font-weight: 600;
    }
</style>
