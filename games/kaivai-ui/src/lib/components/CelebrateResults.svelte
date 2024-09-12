<script lang="ts">
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Celebrate } from '@tabletop/kaivai'
    import { getContext } from 'svelte'
    import PlayerName from './PlayerName.svelte'
    let { action, justify = 'center' }: { action: Celebrate; justify: 'center' | 'left' } = $props()
    let gameSession = getContext('gameSession') as KaivaiGameSession

    let justifyClass = justify === 'center' ? 'justify-center' : 'justify-start'
</script>

{#if action.metadata?.scores && Object.keys(action.metadata.scores).length > 0}
    <div class="flex flex-row {justifyClass} items-center space-x-2 w-full mt-2 text-md">
        <div class="flex flex-col justify-center items-center">
            <div>Glory received</div>
            <div
                class="mt-1 p-2 rounded-lg grid grid-cols-[min-content_min-content_min-content] gap-x-2 gap-y-1 text-center border-2 border-[#634a11]"
            >
                {#each gameSession.gameState.players as player}
                    {#if action.metadata?.scores[player.playerId]}
                        <div class="flex flex-row justify-start items-center">
                            <PlayerName playerId={player.playerId} />
                        </div>
                        <div>{'\u2192'}</div>
                        <div>
                            {action.metadata?.scores[player.playerId]}
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </div>
{/if}
