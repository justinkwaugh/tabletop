<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { Company, EstatesPlayerState } from '@tabletop/estates'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { CaretSortSolid } from 'flowbite-svelte-icons'
    import Cert2d from './Cert2d.svelte'

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
        class="bg-transparent py-0 px-3 text-center {textColor} font-medium flex flex-col justify-between w-[140px] select-none"
    >
        <div class="flex flex-row justify-between items-center">
            <h1 class="text-lg">
                {playerId === gameSession.myPlayer?.id ? 'You' : player?.name}
            </h1>
            <div class="flex flex-row justify-start items-center space-x-4">
                <div class="flex flex-col justify-center items-center">
                    <div class="text-2xl">${playerState?.money}</div>
                </div>
            </div>
        </div>
        <div class="flex flex-row justify-center items-center gap-x-1 mt-1">
            <!-- <div class="rounded-md p-1 text-xs">No certs</div> -->
            {#each playerState?.certificates ?? [] as company}
                <Cert2d {company} class="w-[35px]" />
            {/each}
        </div>
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {playerId}</div>
        {/if}
    </div>
</div>
