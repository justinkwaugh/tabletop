<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { FreshFishPlayerState } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import Disk from '$lib/components/Disk.svelte'
    import { isLightColor, LABEL_DARK, LABEL_LIGHT } from '$lib/utils/pieceColors.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: FreshFishPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let color = $derived(gameSession.colors.getPlayerUiColor(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(player.id))
    let stallInk = $derived(isLightColor(color) ? LABEL_DARK : LABEL_LIGHT)

    function stallInitial(goodsType: string): string {
        return getGoodsName(goodsType).charAt(0).toUpperCase()
    }
</script>

{#snippet stallMarks(size: 'small' | 'large')}
    {#each playerState.stalls as stall (stall.goodsType)}
        <div
            class="stall {size} {stall.placed ? 'placed' : ''}"
            style:--stall-color={color}
            style:--stall-ink={stallInk}
            title={stall.placed
                ? `${getGoodsName(stall.goodsType)} stall placed`
                : `Unplaced ${getGoodsName(stall.goodsType)} stall`}
        >
            {stallInitial(stall.goodsType)}
        </div>
    {/each}
{/snippet}

<div class="rounded-md px-1.5 pb-1.5 {bgColor} {isTurn ? 'turn' : ''}">
    <div class="flex flex-row justify-between items-baseline px-1.5 py-1.5 {textColor}">
        <span class="name">{player.name}</span>
        <span class="name">{playerState.score}<span class="pts">pts</span></span>
    </div>
    <div class="tray flex flex-col gap-2 px-3 max-sm:px-2 py-2 rounded-md">
        <div class="flex flex-row justify-between items-center gap-3 max-sm:gap-2 min-h-[32px]">
            <div class="flex flex-row items-center" title="{playerState.disks} discs in hand">
                {#each Array.from({ length: playerState.disks }, (_, i) => i) as i (i)}
                    <Disk
                        {color}
                        size={32}
                        class="max-sm:size-[26px] {i > 0
                            ? '-ml-[10px] max-sm:-ml-[8px]'
                            : '-ml-[6px] max-sm:-ml-[5px]'}"
                    />
                {:else}
                    <span class="no-discs">No discs</span>
                {/each}
            </div>
            <div class="flex flex-row gap-[3px] sm:hidden">
                {@render stallMarks('small')}
            </div>
            <span class="money" title="Money">${playerState.money}</span>
        </div>
        <div class="flex flex-row gap-1.5 max-sm:hidden">
            {@render stallMarks('large')}
        </div>
    </div>
</div>
{#if gameSession.showDebug}
    <div class="text-xs mt-1">id: {player.id}</div>
{/if}

<style>
    /* Drawn inside the card so the panel's edges never clip it. */
    .turn {
        box-shadow: inset 0 0 0 4px #ffffff;
    }
    .tray {
        background: var(--ff-tray);
        color: #f3f4f6;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    /* Name and score share one style; a line height of 1 keeps the caps centred in the bar. */
    .name {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.2rem;
        line-height: 1;
        padding-top: 2px;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .no-discs {
        font-family: var(--ff-label-font, inherit);
        font-size: 1rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.5;
    }
    .pts {
        margin-left: 3px;
        font-size: 0.8rem;
        opacity: 0.75;
    }
    .money {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.9rem;
        line-height: 1;
        letter-spacing: 0.02em;
        font-variant-numeric: tabular-nums;
    }
    @media (width < 40rem) {
        .money {
            font-size: 1.6rem;
        }
    }
    .stall {
        border-radius: 5px;
        background: var(--stall-color);
        color: var(--stall-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--ff-label-font, inherit);
        line-height: 1;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    .stall.small {
        width: 24px;
        height: 24px;
        font-size: 1rem;
        padding-top: 1px;
    }
    .stall.large {
        width: 46px;
        height: 46px;
        font-size: 1.6rem;
        padding-top: 2px;
    }
    .stall.placed {
        --stall-faded: color-mix(in srgb, var(--stall-color) 50%, #ffffff);
        background: none;
        box-shadow: none;
        border: 2px dashed color-mix(in srgb, var(--stall-faded) 80%, transparent);
        color: color-mix(in srgb, var(--stall-faded) 75%, transparent);
    }
</style>
