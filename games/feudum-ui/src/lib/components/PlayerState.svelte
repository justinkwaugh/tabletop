<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { FeudumProjectedPlayerState } from '@tabletop/feudum'
    import { getTableLayers } from '$lib/components/table/tableLayersContext.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    const layers = getTableLayers()
    let { player, playerState }: { player: Player; playerState: FeudumProjectedPlayerState } =
        $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-2">
            <button
                type="button"
                aria-label="Open {player.name}'s seat"
                data-open-seat-of={player.id}
                onclick={() => layers?.openSeat(player.id)}
            >
                {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
            </button>
        </h1>
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: transparent;
        }
        25% {
            border-color: var(--feudum-text);
        }
        75% {
            border-color: var(--feudum-text);
        }
        100% {
            border-color: transparent;
        }
    }

    .pulse-border {
        border-color: var(--feudum-text);
        animation: border-pulsate 2.5s infinite;
    }
</style>
