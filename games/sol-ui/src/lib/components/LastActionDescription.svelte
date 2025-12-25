<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { aggregateActions } from '$lib/utils/actionAggregator.js'
    import ActionDescription from './ActionDescription.svelte'

    let {
        textColor = 'text-gray-200'
    }: {
        textColor?: string
    } = $props()

    let gameSession = getContext('gameSession') as SolGameSession

    let lastAction = $derived.by(() => {
        const aggregated = Array.from(aggregateActions(gameSession.actions))
        return aggregated.at(-1)
    })
</script>

{#if lastAction}
    <div
        class="bg-transparent {textColor} text-center flex flex-row justify-center items-center p-1 mb-2"
    >
        <div class="flex flex-col justify-center items-center w-full grow-1">
            <h1 class="text-[16px] text-pretty tracking-widest">
                {#if lastAction.playerId}
                    <PlayerName
                        playerId={lastAction.playerId}
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                    />
                {/if}
                <ActionDescription action={lastAction} justify="center" />
            </h1>
        </div>
    </div>
{/if}
