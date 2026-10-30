<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ReserveKinds from './ReserveKinds.svelte'

    // Your potentials in reserve, under the action panel at one height: on your turn, the kind
    // you bring in next is chosen here.
    const session = getGameSession()

    const player = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id) : undefined
    )
</script>

<div class="strip">
    {#if player}
        <ReserveKinds
            {player}
            color={player.color}
            choices={session.pushKinds}
            chosen={session.chosenKind}
            choose={(kind) => session.chooseKind(kind)}
        />
    {/if}
</div>

<style>
    .strip {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 38px;
        padding: 2px 8px 4px;
        color: var(--matrx-ink);
    }
</style>
