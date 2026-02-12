<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { BusPlayerState } from '@tabletop/bus'
    import timeStoneBlueImg from '$lib/images/time_stone_blue.svg'
    import WorkerCylinder from '$lib/components/WorkerCylinder.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: BusPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))
    let playerUiColor = $derived(gameSession.colors.getPlayerUiColor(playerState.playerId))
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
            class="mt-[2px] min-h-[50px] rounded-[0.75rem] bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] p-2"
        >
            <div class="flex items-center justify-between gap-2 text-[rgba(245,248,252,0.95)]">
                <div class="flex items-center gap-1">
                    <svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true">
                        <WorkerCylinder x={15} y={18} color={playerUiColor} width={18} height={28} />
                    </svg>
                    <span class="text-[1.15rem] leading-none font-semibold">{playerState.actions}</span>
                </div>

                <div class="flex items-center gap-1">
                    <svg width="30" height="36" viewBox="0 0 20 24" aria-hidden="true">
                        <line
                            x1="4"
                            y1="19"
                            x2="16"
                            y2="5"
                            stroke={playerUiColor}
                            stroke-width="4.9"
                            stroke-linecap="round"
                        ></line>
                        <line
                            x1="4.6"
                            y1="18.3"
                            x2="15.2"
                            y2="5.9"
                            stroke="rgba(255,255,255,0.3)"
                            stroke-width="1.35"
                            stroke-linecap="round"
                        ></line>
                    </svg>
                    <span class="text-[1.15rem] leading-none font-semibold">{playerState.sticks}</span>
                </div>

                <div class="flex items-center gap-1">
                    <img
                        src={timeStoneBlueImg}
                        alt=""
                        aria-hidden="true"
                        class="h-[34px] w-[34px] shrink-0 select-none"
                    />
                    <span class="text-[1.15rem] leading-none font-semibold">{playerState.stones}</span>
                </div>
            </div>

            {#if gameSession.showDebug}
                <div class="mt-[1px] text-[10px] leading-[1] text-[rgba(245,248,252,0.72)]">id: {player.id}</div>
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
