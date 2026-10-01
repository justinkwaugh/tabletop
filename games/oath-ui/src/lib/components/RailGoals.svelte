<script lang="ts">
    import GoalRows from '$lib/components/GoalRows.svelte'
    import { goalBoard } from '$lib/model/goalBoard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A tap opens the readable view; at board scale the rail is a summary.
    let gameSession = getGameSession()
    let board = $derived(goalBoard(gameSession.gameState))
</script>

<button
    type="button"
    class="rail-goals"
    aria-label="Goals: open the enlarged view"
    aria-expanded={gameSession.goalsView.open}
    onclick={() => gameSession.goalsView.toggle()}
>
    <h3>Goals</h3>
    <GoalRows {board} scale={1} across />
</button>

<style>
    .rail-goals {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        text-align: left;
        cursor: pointer;
    }
    h3 {
        margin: 0;
        color: rgba(253, 230, 138, 0.72);
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: uppercase;
    }
</style>
