<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ActionDescription from './ActionDescription.svelte'

    let { fallbackText }: { fallbackText?: string } = $props()

    const gameSession = getGameSession()
    const lastAction = $derived(gameSession.actions.at(-1))
</script>

<div class="flex w-full items-center justify-center px-4 py-1 text-center text-[16px]">
    {#if lastAction}
        <span class="inline-flex flex-wrap items-center justify-center gap-x-1">
            {#if lastAction.playerId}
                <PlayerName playerId={lastAction.playerId} />
            {/if}
            <ActionDescription action={lastAction} justify="center" />
        </span>
    {:else if fallbackText}
        <span>{fallbackText}</span>
    {/if}
</div>
