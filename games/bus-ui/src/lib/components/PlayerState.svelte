<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { BusPlayerState } from '@tabletop/bus'
    import WorkerCylinder from '$lib/components/WorkerCylinder.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let {
        player,
        playerState,
        showInfo = true
    }: { player: Player; playerState: BusPlayerState; showInfo?: boolean } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))
    let playerUiColor = $derived(gameSession.colors.getPlayerUiColor(playerState.playerId))
</script>

<div class="relative pb-[22px]">
    <div
        class="relative z-[1] min-h-[100px] rounded-t-[1.2rem] rounded-b-[0.45rem] {bgColor} shadow-[inset_0_0_0_1px_rgba(9,13,22,0.26)] py-[3px] px-3 text-right {textColor} font-normal flex flex-col {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
    >
        <div
            class="ml-auto mt-auto mb-[5px] flex items-start gap-x-1 text-[rgba(245,248,252,0.95)]"
        >
            <div class="w-[250px] shrink-0">
                <div
                    class="h-[44px] w-[245px] rounded-[0.58rem] bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] p-[2px] relative overflow-hidden"
                >
                    <div
                        class="absolute inset-[1.5px] rounded-[0.48rem] border border-white/28"
                    ></div>
                    <div class="grid h-full grid-cols-3 gap-[2px]">
                        {#if showInfo}
                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] flex items-center justify-center gap-0.5 px-0.5"
                            >
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    class="shrink-0 select-none"
                                >
                                    <circle cx="12" cy="13" r="7.2" fill={playerUiColor} opacity="0.14"
                                    ></circle>
                                    <circle
                                        cx="12"
                                        cy="13"
                                        r="7.2"
                                        fill="none"
                                        stroke={playerUiColor}
                                        stroke-width="1.8"
                                    ></circle>
                                    <rect
                                        x="10.1"
                                        y="2.1"
                                        width="3.8"
                                        height="2.4"
                                        rx="0.6"
                                        fill={playerUiColor}
                                    ></rect>
                                    <path
                                        d="M14.9 5.2L16.8 3.9"
                                        stroke={playerUiColor}
                                        stroke-width="1.5"
                                        stroke-linecap="round"
                                    ></path>
                                    <path
                                        d="M12 13L12 9.2"
                                        stroke={playerUiColor}
                                        stroke-width="1.8"
                                        stroke-linecap="round"
                                    ></path>
                                    <path
                                        d="M12 13L14.9 14.6"
                                        stroke={playerUiColor}
                                        stroke-width="1.8"
                                        stroke-linecap="round"
                                    ></path>
                                    <circle cx="12" cy="13" r="1.2" fill={playerUiColor}></circle>
                                </svg>
                                <span class="text-[1rem] leading-none font-normal"
                                    >{playerState.stones}</span
                                >
                            </div>

                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] flex items-center justify-center gap-0.5 px-0.5"
                            >
                                <svg width="23" height="27" viewBox="0 0 20 24" aria-hidden="true">
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
                                <span class="text-[1rem] leading-none font-normal"
                                    >{playerState.sticks}</span
                                >
                            </div>

                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] flex items-center justify-center gap-0.5 px-0.5"
                            >
                                <svg width="27" height="30" viewBox="0 0 28 32" aria-hidden="true">
                                    <WorkerCylinder
                                        x={14}
                                        y={16}
                                        color={playerUiColor}
                                        width={19}
                                        height={25}
                                    />
                                </svg>
                                <span class="text-[1rem] leading-none font-normal"
                                    >{playerState.actions}</span
                                >
                            </div>
                        {:else}
                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                            ></div>
                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                            ></div>
                            <div
                                class="h-full rounded-[0.34rem] border border-white/22 bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                            ></div>
                        {/if}
                    </div>
                </div>
                <div
                    class="w-[242px] me-1 rounded-lg border border-[1px] border-white/50 mt-[4px] h-[1px]"
                ></div>
                <h1
                    class="uppercase me-1 ml-auto max-w-[242px] truncate pr-1 text-right text-lg font-semibold tracking-[0.06em]"
                >
                    {player.name}
                </h1>

                {#if gameSession.showDebug}
                    <div
                        class="mt-[1px] pr-[2px] text-right text-[10px] leading-[1] text-[rgba(245,248,252,0.72)]"
                    >
                        id: {player.id}
                    </div>
                {/if}
            </div>

            <div
                class="h-[75px] w-[43px] shrink-0 rounded-[0.5rem] bg-[rgba(12,17,27,0.44)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] relative overflow-hidden"
            >
                <div class="absolute inset-[2px] rounded-[0.38rem] border border-white/32"></div>
                <div
                    class="absolute top-[4px] bottom-[3px] left-[4px] w-[16px] rounded-[0.25rem] bg-[rgba(5,9,16,0.58)]"
                ></div>
                <div
                    class="absolute top-[4px] bottom-[3px] right-[4px] w-[16px] rounded-[0.25rem] bg-[rgba(5,9,16,0.58)]"
                ></div>
                <div
                    class="absolute left-1/2 top-[4px] bottom-[3px] w-[1px] -translate-x-1/2 bg-white/30"
                ></div>
                <div
                    class="absolute left-[18px] top-1/2 h-[8px] w-[1.5px] -translate-y-1/2 rounded-full bg-white/56"
                ></div>
                <div
                    class="absolute right-[18px] top-1/2 h-[8px] w-[1.5px] -translate-y-1/2 rounded-full bg-white/56"
                ></div>
            </div>
        </div>
    </div>
    <div
        class="absolute bottom-0 left-1/4 z-0 h-[22px] w-[44px] translate-x-[calc(-50%-22px)] rounded-b-[22px] {bgColor} shadow-[inset_0_0_0_1px_rgba(9,13,22,0.26)] {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
        aria-hidden="true"
    ></div>
    <div
        class="absolute bottom-0 left-2/3 z-0 h-[22px] w-[44px] translate-x-[calc(-50%+22px)] rounded-b-[22px] {bgColor} shadow-[inset_0_0_0_1px_rgba(9,13,22,0.26)] {isTurn
            ? 'border-2 border-white animate-pulse'
            : ''}"
        aria-hidden="true"
    ></div>
</div>
