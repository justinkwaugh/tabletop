<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ActionPanel from './ActionPanel.svelte'

    /** Exactly one of these (docs: game UI layout): History's description, or the panel. */
    const gameSession = getGameSession()

    let currentAction = $derived(gameSession.currentAction)
</script>

{#if gameSession.isViewingHistory}
    <div
        class="flex items-center justify-center gap-x-1 px-3 py-2 text-sm text-feudum-text"
        data-history-description
    >
        {#if currentAction}
            {#if currentAction.playerId}
                <PlayerName playerId={currentAction.playerId} />
            {/if}
            <ActionDescription action={currentAction} />
        {/if}
    </div>
{:else}
    <ActionPanel />
{/if}
