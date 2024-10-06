<script lang="ts">
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

<div
    class="bg-transparent py-0 px-3 text-center {textColor} font-medium flex flex-col justify-between w-[140px] h-[55px] select-none"
>
    <div class="flex flex-row justify-between items-start">
        <h1 class="text-md">
            {playerId === gameSession.myPlayer?.id ? 'You ' : player?.name}
        </h1>

        <div class="flex flex-col justify-center items-center">
            <div class="text-2xl">${playerState?.money}</div>
        </div>
    </div>
    <div class="flex flex-row justify-center items-center gap-x-1 mt-1">
        {#if (playerState?.certificates.length ?? 0) === 0}
            <h1 class="text-xs text-gray-500">NO CERTIFICATES</h1>
        {/if}
        {#each playerState?.certificates ?? [] as company}
            <Cert2d {company} class="w-[35px]" />
        {/each}
    </div>
    {#if gameSession.showDebug}
        <div class="text-xs mt-2">id: {playerId}</div>
    {/if}
</div>
