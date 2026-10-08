<script lang="ts">
    import WoodStall from '$lib/components/WoodStall.svelte'
    import BagIcon from '$lib/components/BagIcon.svelte'
    import { UNCLAIMED_STALL } from '$lib/utils/pieceColors.js'
    import type { GoodsType } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession()

    function playerForFinalStall(goodsType: GoodsType) {
        const playersWithUnplacedStall = gameSession.gameState.players.filter((player) =>
            player.stalls.find((stall) => stall.goodsType === goodsType && !stall.placed)
        )

        return playersWithUnplacedStall.length === 1 ? playersWithUnplacedStall[0] : undefined
    }
</script>

<div class="mb-3 flex flex-row justify-between items-center gap-3">
    <div class="flex flex-row items-center gap-3">
        <div class="plate" title="Tiles left in the bag">
            <BagIcon size={58} />
            <div class="flex flex-col items-center leading-none">
                <span class="big">{gameSession.gameState.tileBag.remaining}</span>
                <span class="heading">Tiles</span>
            </div>
        </div>
        <div class="plate">
            <span class="heading mr-1">Final<br />stalls</span>
            {#each gameSession.gameState.finalStalls as stall (stall.goodsType)}
                {@const owner = playerForFinalStall(stall.goodsType)}
                <div class="final" title={owner ? 'Last stall left' : 'Unclaimed'}>
                    <WoodStall
                        size={56}
                        color={owner
                            ? gameSession.colors.getPlayerUiColor(owner.playerId)
                            : UNCLAIMED_STALL}
                        goodsType={stall.goodsType}
                    />
                </div>
            {/each}
        </div>
    </div>
    {#if gameSession.gameState.boardSeed !== undefined}
        <span class="seed">board #{gameSession.gameState.boardSeed}</span>
    {/if}
</div>

<style>
    .plate {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        height: 76px;
        padding: 10px 16px;
        border-radius: 12px;
        background: rgba(5, 20, 28, 0.45);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        color: var(--ff-label);
    }
    .big {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.9rem;
        font-variant-numeric: tabular-nums;
    }
    .heading {
        font-family: var(--ff-label-font, inherit);
        font-size: 1rem;
        line-height: 1.05;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
        color: var(--ff-label);
    }
    .final {
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
    }
    .seed {
        align-self: flex-start;
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--ff-label) 55%, transparent);
    }
</style>
