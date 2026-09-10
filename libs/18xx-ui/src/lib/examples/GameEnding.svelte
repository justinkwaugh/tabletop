<script lang="ts">
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const state = $derived(session.financialState)
</script>

{#if state.gameEnding}
    <section aria-label="Game ending">
        <header>
            <h2>{state.finalWealth ? 'Final wealth' : 'Game ending'}</h2>
            <button
                onclick={() => session.undo()}
                disabled={session.busy ||
                    session.updatingVisibleState ||
                    session.isViewingHistory ||
                    !session.undoableAction}>Undo</button
            >
        </header>
        <p>
            {state.gameEnding.reason}{state.finalWealth
                ? ' · Game over'
                : ` · Ends after operating set ${state.gameEnding.finalOperatingSet}`}
        </p>
        {#if state.finalWealth}
            <p>
                Winner{state.winningPlayerIds.length > 1 ? 's' : ''}: {state.winningPlayerIds
                    .map((id) => session.getPlayerName(id))
                    .join(', ')}
            </p>
            <table aria-label="Final wealth">
                <thead><tr><th>Player</th><th>Wealth</th><th>Assets</th></tr></thead><tbody>
                    {#each state.finalWealth as player}
                        <tr
                            ><th>{session.getPlayerName(player.playerId)}</th><td
                                >${player.total}</td
                            ><td
                                ><details>
                                    <summary>Show valuation</summary>
                                    <ul>
                                        {#each player.items as item}<li>
                                                {item.label}: ${item.value}
                                            </li>{/each}
                                    </ul>
                                </details></td
                            ></tr
                        >
                    {/each}
                </tbody>
            </table>
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 20px;
        margin-bottom: 20px;
        background: #fffefa;
        border: 1px solid #b0c0b4;
        border-radius: 8px;
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    h2 {
        margin: 0;
        font-size: 18px;
    }
    button {
        padding: 8px 14px;
        border: 1px solid #aebfb4;
        border-radius: 5px;
        background: white;
        font: inherit;
        cursor: pointer;
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th,
    td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #d7dfd7;
        vertical-align: top;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
