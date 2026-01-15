<script lang="ts">
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Celebrate } from '@tabletop/kaivai'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let {
        action,
        justify = 'center',
        history = false
    }: { action: Celebrate; justify: 'center' | 'left'; history?: boolean } = $props()
    let gameSession = getGameSession() as KaivaiGameSession

    let justifyClass = justify === 'center' ? 'justify-center' : 'justify-start'
</script>

{#if action.metadata?.scores && Object.keys(action.metadata.scores).length > 0}
    <div class="flex flex-row {justifyClass} items-center space-x-2 w-full mt-2 text-md">
        <div class="flex flex-col justify-center items-center">
            <div
                class="mt-1 p-2 rounded-lg grid grid-cols-[min-content_min-content] gap-x-2 gap-y-1 text-center border-2 border-[#634a11]"
            >
                {#each gameSession.gameState.players as player (player.playerId)}
                    {#if action.metadata?.scores[player.playerId]}
                        <div class="flex flex-row justify-end items-center">
                            <PlayerName
                                playerId={player.playerId}
                                capitalization={history ? 'capitalize' : 'uppercase'}
                            />
                        </div>
                        <div class="text-nowrap">
                            +{action.metadata?.scores[player.playerId]} glory
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </div>
{/if}
