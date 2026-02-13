<script lang="ts">
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { aggregateActions } from '$lib/utils/actionAggregator.js'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        textColor = 'text-[#333]',
        fallbackText
    }: {
        textColor?: string
        fallbackText?: string
    } = $props()

    const gameSession = getGameSession() as BusGameSession

    const lastAction = $derived.by(() => {
        const aggregated = Array.from(aggregateActions(gameSession.actions))
        return aggregated.at(-1)
    })
</script>

    <div class={`bg-transparent ${textColor} flex w-full items-center justify-center px-4 py-1 text-center`}>
    {#if lastAction}
        <h1 class="inline-flex items-center text-[18px] tracking-[0.02em]">
            {#if lastAction.playerId}
                <PlayerName
                    playerId={lastAction.playerId}
                    additionalClasses="tracking-[0.08em]"
                />
            {/if}
            <ActionDescription action={lastAction} justify="center" history={true} fullWidth={false} />
        </h1>
    {:else if fallbackText}
        <span class="text-[18px] tracking-[0.02em]">{fallbackText}</span>
    {/if}
</div>
