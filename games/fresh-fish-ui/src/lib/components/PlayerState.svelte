<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { FreshFishPlayerState } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import WoodStall from '$lib/components/WoodStall.svelte'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import Disk from '$lib/components/Disk.svelte'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: FreshFishPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let color = $derived(gameSession.colors.getPlayerUiColor(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(player.id))
</script>

<div class="rounded-md px-1.5 pb-1.5 {bgColor} {isTurn ? 'turn' : ''}">
    <div class="flex flex-row justify-between items-baseline px-1.5 py-1.5 {textColor}">
        <span class="name">{player.name}</span>
        <span class="name">{playerState.score}<span class="pts">pts</span></span>
    </div>
    <div class="tray flex flex-col gap-2 px-3 py-2 rounded-md">
        <div class="flex flex-row justify-between items-center gap-3 min-h-[32px]">
            <div class="flex flex-row items-center" title="{playerState.disks} discs in hand">
                {#each Array.from({ length: playerState.disks }, (_, i) => i) as i (i)}
                    <Disk {color} size={32} class={i > 0 ? '-ml-[10px]' : '-ml-[6px]'} />
                {:else}
                    <span class="no-discs">No discs</span>
                {/each}
            </div>
            <span class="money" title="Money">${playerState.money}</span>
        </div>
        <div class="flex flex-row gap-1.5">
            {#each playerState.stalls as stall (stall.goodsType)}
                {#if stall.placed}
                    <div
                        class="slot"
                        style:--slot-color={color}
                        title="{getGoodsName(stall.goodsType)} stall placed"
                    >
                        {getGoodsName(stall.goodsType).charAt(0).toUpperCase()}
                    </div>
                {:else}
                    <div class="tile" title="Unplaced {getGoodsName(stall.goodsType)} stall">
                        <WoodStall size={46} {color} goodsType={stall.goodsType} />
                    </div>
                {/if}
            {/each}
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
    .slot {
        width: 46px;
        height: 46px;
        border-radius: 5px;
        --slot-ink: color-mix(in srgb, var(--slot-color) 50%, #ffffff);
        border: 2px dashed color-mix(in srgb, var(--slot-ink) 80%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--ff-label-font, inherit);
        font-size: 1.6rem;
        line-height: 1;
        color: color-mix(in srgb, var(--slot-ink) 75%, transparent);
    }
    .tile {
        border-radius: 5px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
</style>
