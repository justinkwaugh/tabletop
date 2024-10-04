<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { EstatesPlayerState } from '@tabletop/estates'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let { playerId }: { playerId: String } = $props()

    let player = $derived(gameSession.game.players.find((p) => p.id === playerId))
    let playerState = $derived(gameSession.gameState.players.find((p) => p.playerId === playerId))

    let isTurn = $derived(player && gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.getPlayerBgColor(player?.id))
    let textColor = $derived(gameSession.getPlayerTextColor(player?.id))
</script>

<div class="relative">
    <div
        class="rounded-lg bg-transparent py-[3px] px-4 text-center {textColor} font-medium flex flex-col justify-between w-[150px] select-none"
    >
        <h1 class="text-lg font-mediummb-2">
            {player?.name}
        </h1>
        <div class="flex flex-row justify-between items-start">
            <div class="flex flex-row justify-start items-center space-x-4">
                <div class="flex flex-col justify-center items-center">
                    <div class="text-2xl">${playerState?.money}</div>
                </div>
            </div>
            <div class="flex flex-col justify-center items-center"></div>
        </div>
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {playerId}</div>
        {/if}
    </div>
</div>
