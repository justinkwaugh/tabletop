<script lang="ts">
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Celebrate, MoveGod } from '@tabletop/kaivai'
    import { getContext } from 'svelte'
    import PlayerName from './PlayerName.svelte'
    let { action, justify = 'center' }: { action: MoveGod; justify: 'center' | 'left' } = $props()
    let gameSession = getContext('gameSession') as KaivaiGameSession

    let justifyClass = justify === 'center' ? 'justify-center' : 'justify-start'
</script>

{#if action.metadata?.influenceGained && Object.keys(action.metadata.influenceGained).length > 0}
    <div class="flex flex-row {justifyClass} items-center space-x-2 w-full mt-2">
        <div class="flex flex-col justify-center items-center text-md">
            <div
                class="mt-1 p-2 rounded-lg grid grid-cols-[min-content_min-content] gap-x-2 gap-y-1 text-center border-2 border-[#634a11]"
            >
                {#each gameSession.gameState.players as player}
                    {#if action.metadata?.influenceGained[player.playerId]}
                        <div class="flex flex-row justify-end items-center">
                            <PlayerName playerId={player.playerId} />
                        </div>
                        <div class="text-nowrap">
                            +{action.metadata?.influenceGained[player.playerId]} influence
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    </div>
{/if}
