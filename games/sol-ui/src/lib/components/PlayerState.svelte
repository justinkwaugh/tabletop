<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { SolPlayerState, MachineState } from '@tabletop/sol'
    import type { Player } from '@tabletop/common'

    let gameSession = getContext('gameSession') as SolGameSession
    let { player, playerState }: { player: Player; playerState: SolPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(playerState.playerId))
    let bgColor = $derived(gameSession.getPlayerBgColor(playerState.playerId))
    let textColor = $derived(gameSession.getPlayerTextColor(playerState.playerId))
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-2">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div class="flex flex-row justify-between items-center"></div>
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
