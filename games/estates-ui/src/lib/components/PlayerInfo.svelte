<script lang="ts">
import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cert2d from './Cert2d.svelte'
    import { MachineState } from '@tabletop/estates'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as EstatesGameSession
    let { playerId }: { playerId: String } = $props()

    let player = $derived(gameSession.game.players.find((p) => p.id === playerId))
    let playerState = $derived(gameSession.gameState.players.find((p) => p.playerId === playerId))

    let isTurn = $derived(player && gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player?.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(player?.id))

    function certWidthForCount(certCount: number) {
        if (certCount === 1) {
            return 'w-[45px]'
        } else if (certCount === 2) {
            return 'w-[45px]'
        } else if (certCount === 3) {
            return 'w-[35px]'
        } else if (certCount === 4) {
            return 'w-[30px]'
        } else {
            return 'w-[25px]'
        }
    }

    const hideMoney = $derived(gameSession.game.config?.hiddenMoney ?? false)
</script>

<div
    class="rounded-[5px] bg-transparent py-0 ps-1 pe-1 text-center {textColor} font-medium flex flex-col justify-between w-[130px] h-[66px] select-none overflow-hidden"
>
    <div class="flex flex-row justify-between items-start mt-1">
        <div
            class="flex flex-col justify-start items-start overflow-hidden text-ellipsis text-nowrap"
        >
            <h1 class="leading-none text-sm">
                {playerId === gameSession.myPlayer?.id ? 'You' : player?.name}
            </h1>
            {#if playerState?.stolen && !hideMoney}
                <h1 class="text-gray-300" style="font-size:.5rem; line-height:.65rem">
                    stole ${playerState?.stolen}
                </h1>
            {/if}
        </div>

        <div class="flex flex-col justify-center items-center ms-1">
            {#if gameSession.gameState.machineState === MachineState.EndOfGame}
                <div class="text-xs leading-none">SCORE</div>
                <div class="text-xl leading-none">{playerState?.score}</div>
            {:else if !hideMoney || playerId === gameSession.myPlayer?.id}
                <div class="text-2xl leading-none">${playerState?.money}</div>
            {/if}
        </div>
    </div>
    <div class="h-full flex flex-col justify-center items-center gap-y-0">
        <div class="flex flex-row justify-center items-center gap-x-1">
            {#if (playerState?.certificates.length ?? 0) === 0}
                <h1 class="text-xs text-gray-400">NO CERTIFICATES</h1>
            {/if}
            {#each playerState?.certificates ?? [] as company, i}
                {#if i < 4}
                    <Cert2d
                        {company}
                        class=" {certWidthForCount(playerState?.certificates.length ?? 0)}"
                    />
                {/if}
            {/each}
        </div>
        {#if (playerState?.certificates.length ?? 0) > 4}
            <div class="flex flex-row justify-center items-center gap-x-1">
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
        <div class="text-xs mt-2">id: {playerId}</div>
    {/if}
</div>
