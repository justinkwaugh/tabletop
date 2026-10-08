<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, GOODS, totalGoods } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import CubeIcon from '../ui/CubeIcon.svelte'
    import GoodsList from '../ui/GoodsList.svelte'

    const gameSession = getGameSession()
    const raid = $derived(gameSession.gameState.raid)
    const me = $derived(gameSession.me)
    const pile = $derived(gameSession.pile)
    const cargo = $derived(me ? totalGoods(me.goods) : 0)
    const pileSize = $derived(totalGoods(pile))
    const even = $derived(Math.abs(cargo - 2 * pileSize) <= 1)
</script>

{#if raid && gameSession.can(ActionType.DivideSpoils) && me}
    <div class="flex flex-col gap-2">
        <div class="kogge-prompt inline-flex gap-1">
            <PlayerName playerId={raid.raiderId} />
            <span>robs your cog! Split your cargo into two halves; they take one.</span>
        </div>
        <div class="flex flex-wrap gap-2">
            {#each GOODS.filter((good) => me.goods[good] > 0) as good (good)}
                <div
                    class="inline-flex items-center gap-1 rounded border border-[#8a6a3c] bg-[#f9f1dc] px-1"
                >
                    <button
                        class="px-1 text-lg"
                        aria-label="One fewer {GOOD_ART[good].name}"
                        onclick={() => gameSession.adjustPile(good, -1)}>−</button
                    >
                    <CubeIcon {good} size={20} />
                    <span class="tabular-nums">{pile[good]} | {me.goods[good] - pile[good]}</span>
                    <button
                        class="px-1 text-lg"
                        aria-label="One more {GOOD_ART[good].name}"
                        onclick={() => gameSession.adjustPile(good, 1)}>+</button
                    >
                </div>
            {/each}
        </div>
        <div class="flex items-center gap-3">
            <span class="kogge-note"
                >Piles of {pileSize} and {cargo - pileSize}{even
                    ? ''
                    : ' — they may differ by one good at most'}</span
            >
            <button
                class="kogge-button kogge-button-primary ml-auto"
                disabled={!even}
                onclick={() => gameSession.divideSpoils()}>Split</button
            >
        </div>
    </div>
{:else if raid && gameSession.can(ActionType.ChooseSpoils) && raid.spoils}
    <div class="flex flex-col gap-2">
        <div class="kogge-prompt inline-flex gap-1">
            <span>Take one of the piles</span>
            <PlayerName playerId={raid.victimId} /> <span>has made</span>
        </div>
        <div class="flex flex-wrap gap-2">
            {#each raid.spoils as spoil, index (index)}
                <button class="kogge-button" onclick={() => gameSession.chooseSpoils(index)}
                    ><GoodsList goods={spoil} /></button
                >
            {/each}
        </div>
    </div>
{/if}
