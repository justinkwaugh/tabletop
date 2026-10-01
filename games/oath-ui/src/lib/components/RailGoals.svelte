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
</style>
