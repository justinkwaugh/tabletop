<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'
    import RailroadBadge from './RailroadBadge.svelte'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const activeId = $derived(state.activePlayerIds[0])
    const lastAction = $derived(
        gameSession.actions.findLast((action) => action.playerId !== undefined)
    )
</script>

<div class="waiting">
    {#if activeId && state.machineState === MachineState.Expanding && state.expansion}
        <div>
            Waiting for <PlayerName playerId={activeId} /> to finish building
            <RailroadBadge railroadId={state.expansion.railroadId} /> track.
        </div>
    {:else if activeId}
        <div>
            Waiting for <PlayerName playerId={activeId} /> to build, offer a share or pass.
        </div>
    {/if}
    {#if lastAction}
        <div class="last">Last: <Description description={describeAction(lastAction)} /></div>
    {/if}
</div>

<style>
    .waiting {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .last {
        color: var(--po-muted);
        font-size: 14px;
    }
</style>
