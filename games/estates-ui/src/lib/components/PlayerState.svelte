<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cert2d from './Cert2d.svelte'
    import { EstatesPlayerState, MachineState } from '@tabletop/estates'
    import type { Player } from '@tabletop/common'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let { player, playerState }: { player: Player; playerState: EstatesPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(playerState.playerId))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(playerState.playerId))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))

    function certWidthForCount(certCount: number) {
        return 'w-[70px]'
    }
</script>

<div
    class="rounded-[5px] bg-[#333333] border-2 border-[#444444] p-2 text-center {textColor} font-medium flex flex-col justify-between w-full select-none overflow-hidden"
>
    <div class="flex flex-row justify-between items-start">
        <div
            class="flex flex-col justify-start items-start overflow-hidden text-ellipsis text-nowrap"
        >
            <h1
                class="text-ellipsis overflow-hidden text-nowrap {isTurn
                    ? 'text-lg font-semibold'
                    : 'text-lg font-medium'}"
            >
                {isTurn ? '\u276f' : ''}
                {player.name}
            </h1>
            {#if playerState?.stolen}
                <h1 class="text-gray-300 text-xs leading-none mb-1">
                    stole ${playerState?.stolen}
                </h1>
            {/if}
        </div>

        <div class="flex flex-col justify-center items-center ms-1">
            {#if gameSession.gameState.machineState === MachineState.EndOfGame}
                <div class="text-xs leading-none">SCORE</div>
                <div class="text-xl leading-none">{playerState?.score}</div>
            {:else}
                <div class="text-2xl leading-none">${playerState?.money}</div>
            {/if}
        </div>
    </div>
    <div class="h-full flex flex-col justify-center items-center gap-y-0">
        <div class="flex flex-row justify-center items-center gap-x-2">
            {#if (playerState?.certificates.length ?? 0) === 0}
                <h1 class="text-md text-gray-400">NO CERTIFICATES</h1>
            {/if}
            {#each playerState?.certificates ?? [] as company, i}
                {#if i < 4}
                    <div class="rounded-sm overflow-hidden">
                        <Cert2d
                            {company}
                            class=" {certWidthForCount(playerState?.certificates.length ?? 0)}"
                        />
                    </div>
                {/if}
            {/each}
        </div>
        {#if (playerState?.certificates.length ?? 0) > 4}
            <div class="flex flex-row justify-center items-center gap-x-0">
                {#each playerState?.certificates ?? [] as company, i}
                    {#if i >= 4}
                        <Cert2d
                            {company}
                            class=" {certWidthForCount(playerState?.certificates.length ?? 0)}"
                        />
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
    {#if gameSession.showDebug}
        <div class="text-xs mt-2">id: {playerState.playerId}</div>
    {/if}
</div>
