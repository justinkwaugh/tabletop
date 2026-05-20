<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { PlayerName } from '@tabletop/frontend-components'

    const session = getGameSession()
    const state = $derived(session.gameState)

    function isWinner(playerId: string): boolean {
        return state.winningPlayerIds.includes(playerId)
    }
</script>

<div class="flex flex-col gap-2 border-b border-[#c8bfaf] bg-[#f0ebe2] px-4 py-3">
    <div class="font-bold text-[#2c1810]">
        {#if state.winningPlayerIds.length > 1}
            It's a tie!
        {:else if state.winningPlayerIds.includes(session.myPlayer?.id ?? '')}
            You win!
        {:else}
            Game over
        {/if}
    </div>
    <div class="flex gap-4">
        {#each state.players.toSorted((a, b) => b.score - a.score) as player}
            <div class="flex items-center gap-2">
                <div
                    class="h-3 w-3 rounded-full border border-gray-400"
                    style:background-color={session.colors.getPlayerUiColor(player.playerId)}
                ></div>
                <span class="text-sm text-[#2c1810]">
                    <PlayerName playerId={player.playerId} />:
                    <strong>{player.score} pts</strong>
                    {#if isWinner(player.playerId)} ★{/if}
                </span>
            </div>
        {/each}
    </div>
</div>
