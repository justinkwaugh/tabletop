<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { HydratedKaivaiPlayerState } from '@tabletop/kaivai'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let { player, playerState }: { player: Player; playerState: HydratedKaivaiPlayerState } =
        $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.getPlayerBgColor(player.id))
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
        <div class="flex flex-row justify-between items-center">
            <div class="flex flex-row justify-start items-center space-x-2 ms-4">
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">move</div>
                    <div class="text-xl">{playerState.baseMovement}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">build</div>
                    <div class="text-xl">{playerState.buildingCost}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">money</div>
                    <div class="text-xl">{playerState.money()}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">influence</div>
                    <div class="text-xl">{playerState.influence}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">score</div>
                    <div class="text-xl">{playerState.score}</div>
                </div>
            </div>
        </div>
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
