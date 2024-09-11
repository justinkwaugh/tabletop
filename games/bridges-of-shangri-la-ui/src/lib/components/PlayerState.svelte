<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { BridgesPlayerState, MasterType } from '@tabletop/bridges-of-shangri-la'
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'

    let gameSession = getContext('gameSession') as BridgesGameSession
    let { player, playerState }: { player: Player; playerState: BridgesPlayerState } = $props()

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
            {#each Object.entries(playerState.pieces) as [masterType, count]}
                <div class="flex flex-row justify-start items-center space-x-2">
                    <div class="flex flex-col justify-center items-center">
                        <div class="" style="font-size:.7rem; line-height:.8rem">
                            <img
                                src={gameSession.imageForMasterType(masterType as MasterType)}
                                alt="master type"
                            />
                        </div>
                        <div class="text-md">{count}</div>
                    </div>
                </div>
            {/each}
            <div class="flex flex-row justify-start items-center space-x-2 ms-4">
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
