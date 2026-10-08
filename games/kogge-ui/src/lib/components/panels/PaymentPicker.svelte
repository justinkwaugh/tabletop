<script lang="ts">
    import { cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import CubeIcon from '../ui/CubeIcon.svelte'
    import ShieldIcon from '../ui/ShieldIcon.svelte'

    const gameSession = getGameSession()
    const pending = $derived(gameSession.pendingSail)
    const cost = $derived(gameSession.paymentCost)
    const remaining = $derived(cost - gameSession.payment.length)
    const me = $derived(gameSession.me)

    function available(item: (typeof gameSession.paymentChoices)[number]): boolean {
        if (!me) return false
        const used = gameSession.payment.filter((paid) =>
            paid.kind === 'good' && item.kind === 'good'
                ? paid.good === item.good
                : paid.kind === 'marker' && item.kind === 'marker' && paid.value === item.value
        ).length
        const held =
            item.kind === 'good'
                ? me.goods[item.good]
                : (me.markers ?? []).filter((marker) => marker === item.value).length
        return used < held
    }
</script>

<div class="flex flex-col gap-1">
    <div class="kogge-prompt">
        {#if pending}
            Pay {remaining} more to sail
            {#if pending.destination !== undefined}to {cityInfo(pending.destination)
                    .name}{:else}along the hidden route{/if}
        {:else}
            Pay one good for the route markers
        {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
        {#each gameSession.paymentChoices as item (item.kind === 'good' ? item.good : `m${item.value}`)}
            <button
                class="kogge-button inline-flex items-center gap-1 !px-2"
                disabled={!available(item)}
                onclick={() => gameSession.addPaymentItem(item)}
            >
                {#if item.kind === 'good'}
                    <CubeIcon good={item.good} size={20} />
                    <span>{GOOD_ART[item.good].name}</span>
                {:else}
                    <ShieldIcon value={item.value} size={22} />
                {/if}
            </button>
        {/each}
    </div>
    <div class="kogge-note">Undo takes back a choice.</div>
</div>
