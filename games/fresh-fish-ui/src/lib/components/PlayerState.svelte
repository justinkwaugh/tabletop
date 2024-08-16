<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { FreshFishPlayerState, GoodsType, PlayerColor } from '@tabletop/fresh-fish'
    import { uiBgColorForPlayer } from '$lib/utils/playerColors'
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'

    let gameSession = getContext('gameSession') as FreshFishGameSession
    let { player, playerState }: { player: Player; playerState: FreshFishPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))

    let bgColor = $derived(uiBgColorForPlayer(playerState.color))

    let textColor = $derived.by(() => {
        switch (playerState.color) {
            case PlayerColor.Yellow:
                return 'text-black'
            default:
                return 'text-white'
        }
    })

    function letterForGoodsType(goodsType: string) {
        switch (goodsType) {
            case GoodsType.Cheese:
                return 'C'
            case GoodsType.Fish:
                return 'F'
            case GoodsType.IceCream:
                return 'G'
            case GoodsType.Lemonade:
                return 'S'
            default:
                return ''
        }
    }
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {textColor} font-medium flex flex-col justify-between {isTurn
            ? 'border-2 pulse-border'
            : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-2">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div class="flex flex-row justify-between items-start">
            <div class="flex flex-row justify-start items-center space-x-4">
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">disks</div>
                    <div class="text-sm">{playerState.disks}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">money</div>
                    <div class="text-sm">${playerState.money}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="" style="font-size:.7rem; line-height:.8rem">score</div>
                    <div class="text-sm">{playerState.score}</div>
                </div>
            </div>
            <div class="flex flex-col justify-center items-center">
                <div class="" style="font-size:.7rem; line-height:.8rem">unplaced stalls</div>
                <div class="flex flex-row justify-start items-center space-x-2">
                    {#each playerState.stalls as stall}
                        {#if !stall.placed}
                            <div class="text-sm">
                                {letterForGoodsType(stall.goodsType)}
                            </div>
                        {/if}
                    {/each}
                    {#if playerState.stalls.filter((s) => !s.placed).length === 0}
                        <div class="text-sm">-</div>
                    {/if}
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
