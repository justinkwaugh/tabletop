<script lang="ts">
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ActionPanel from './ActionPanel.svelte'

    /** docs/game-ui-layout.md, Action area views: exactly one, History's description or the panel. */
    const gameSession = getGameSession()

    let currentAction = $derived(gameSession.currentAction)
</script>

{#if gameSession.isViewingHistory}
    <div
        class="flex items-center justify-center gap-x-1 px-3 py-2 text-sm text-feudum-text"
        data-history-description
    >
        {#if currentAction}
            <ActionDescription action={currentAction} />
        {/if}
    </div>
{:else}
    <ActionPanel />
{/if}
