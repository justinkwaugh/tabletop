<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { BusPlayerState } from '@tabletop/bus'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: BusPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))
</script>

<div class="relative pb-[22px]">
    <div
        class="relative z-[1] min-h-[100px] rounded-t-[1.2rem] rounded-b-[0.45rem] {bgColor} py-[3px] px-4 text-right {textColor} font-medium flex flex-col {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
    >
        <h1 class={isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'}>
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div
            class="mt-[2px] min-h-[50px] rounded-[0.75rem] bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] flex items-center justify-center px-2 py-1"
        >
            {#if gameSession.showDebug}
                <div class="text-xs leading-[1.1] text-[rgba(245,248,252,0.9)]">
                    id: {player.id}
                </div>
            {:else}
                <div class="h-px w-full" aria-hidden="true"></div>
            {/if}
        </div>
    </div>
    <div
        class="absolute bottom-0 left-1/4 z-0 h-[22px] w-[44px] translate-x-[calc(-50%-22px)] rounded-b-[22px] {bgColor} {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
        aria-hidden="true"
    ></div>
    <div
        class="absolute bottom-0 left-3/4 z-0 h-[22px] w-[44px] translate-x-[calc(-50%+22px)] rounded-b-[22px] {bgColor} {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
        aria-hidden="true"
    ></div>
</div>
