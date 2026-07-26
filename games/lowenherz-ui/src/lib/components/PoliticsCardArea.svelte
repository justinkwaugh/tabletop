<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PlayerName } from '@tabletop/frontend-components'

    const gameSession = getGameSession()

    function playerIdForColor(color: string): string | undefined {
        return gameSession.gameState.players.find((p) => p.color === color)?.playerId
    }
</script>

<div class="flex flex-col gap-2">
    {#if gameSession.myCancellableAlliances.length > 0}
        <div class="flex flex-col gap-1">
            <span class="text-black text-sm font-medium">Your alliances</span>
            <div class="flex flex-col gap-1">
                {#each gameSession.myCancellableAlliances as alliance (alliance.id)}
                    {@const otherPlayerId = playerIdForColor(alliance.otherColor)}
                    <div class="flex items-center gap-2 text-black text-sm">
                        <span>
                            Allied with
                            {#if otherPlayerId}
                                <PlayerName playerId={otherPlayerId} />
                            {:else}
                                a neutral prince
                            {/if}
                        </span>
                        <button
                            type="button"
                            class="px-1.5 py-0.5 rounded bg-black/10 text-black text-xs hover:bg-black/20"
                            onclick={() => gameSession.cancelAlliance(alliance.id)}
                        >
                            Cancel (10 ducats)
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
