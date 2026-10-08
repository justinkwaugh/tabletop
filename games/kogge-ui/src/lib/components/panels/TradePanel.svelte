<script lang="ts">
    import { GOODS, totalGoods, type Good } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import CubeIcon from '../ui/CubeIcon.svelte'

    const gameSession = getGameSession()
    const me = $derived(gameSession.me)
    const market = $derived(
        me?.city !== undefined ? gameSession.gameState.cities[me.city].goods : undefined
    )
    const draft = $derived(gameSession.trade)
    const given = $derived(totalGoods(draft.give))
    const taken = $derived(totalGoods(draft.take))
    const ratio = $derived(gameSession.tradeRatio)

    function hint(): string {
        if (given === 0) return 'Choose goods from your cog to offer.'
        if (taken < given)
            return `Take at least ${given} good${given === 1 ? '' : 's'} of other kinds.`
        if (taken > given * ratio) return `You may take at most ${given * ratio}.`
        return `${given} for ${taken}.`
    }
</script>

{#snippet side(title: string, key: 'give' | 'take', limit: (good: Good) => number)}
    <div class="flex flex-col gap-1">
        <div class="kogge-note">{title}</div>
        <div class="flex flex-wrap gap-2">
            {#each GOODS as good (good)}
                {#if limit(good) > 0}
                    <div
                        class="inline-flex items-center gap-1 rounded border border-[#8a6a3c] bg-[#f9f1dc] px-1"
                    >
                        <button
                            class="px-1 text-lg leading-none"
                            aria-label="One fewer {GOOD_ART[good].name}"
                            disabled={draft[key][good] === 0}
                            onclick={() => gameSession.adjustTrade(key, good, -1)}>−</button
                        >
                        <CubeIcon {good} size={20} />
                        <span class="w-9 text-center tabular-nums"
                            >{draft[key][good]}/{limit(good)}</span
                        >
                        <button
                            class="px-1 text-lg leading-none"
                            aria-label="One more {GOOD_ART[good].name}"
                            disabled={draft[key][good] >= limit(good)}
                            onclick={() => gameSession.adjustTrade(key, good, 1)}>+</button
                        >
                    </div>
                {/if}
            {/each}
        </div>
    </div>
{/snippet}

{#if me && market}
    <div class="flex flex-col gap-2 rounded-md border border-[#8a6a3c] bg-[#efe3c3] p-2">
        <div class="kogge-note">
            Each good from your cog buys up to {ratio} goods of other kinds lying in the city.
        </div>
        <div class="flex flex-wrap gap-6">
            {@render side('You give', 'give', (good) => me.goods[good])}
            {@render side('You take', 'take', (good) => market[good])}
        </div>
        <div class="flex items-center gap-3">
            <span class="kogge-note">{hint()}</span>
            <button
                class="kogge-button kogge-button-primary ml-auto"
                disabled={!gameSession.tradeIsValid}
                onclick={() => gameSession.confirmTrade()}>Trade</button
            >
        </div>
    </div>
{/if}
