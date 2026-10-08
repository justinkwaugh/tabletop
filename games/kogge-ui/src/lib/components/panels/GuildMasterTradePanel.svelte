<script lang="ts">
    import {
        ActionType,
        BONUS_CHITS,
        GOODS,
        markerGood,
        markerValuesForGood,
        type BonusChit,
        type Good
    } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BONUS_CHIT_NAMES } from '$lib/utils/story.js'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import CubeIcon from '../ui/CubeIcon.svelte'
    import ShieldIcon from '../ui/ShieldIcon.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const me = $derived(gameSession.me)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const bonusGoods = $derived(
        gameSession.can(ActionType.ClaimBonusChit) ? game.bonusChitGoods(playerId) : []
    )
    const raidValues = $derived(
        gameSession.can(ActionType.ClaimRaidMarker) ? game.claimableRaidMarkerValues(playerId) : []
    )
    let bonusGood: Good | undefined = $state()
    const chosenBonusGood = $derived(
        bonusGood && bonusGoods.includes(bonusGood) ? bonusGood : bonusGoods[0]
    )
    const availableChits = $derived(BONUS_CHITS.filter((chit) => game.bonusSupply.includes(chit)))
    const sellable = $derived(
        gameSession.can(ActionType.ExchangeMarkerForGood)
            ? [...new Set(me?.markers ?? [])].filter((value) => game.supply[markerGood(value)] > 0)
            : []
    )

    function claim(chit: BonusChit) {
        if (chosenBonusGood) gameSession.claimBonusChit(chosenBonusGood, chit)
    }
</script>

<div class="flex flex-col gap-2 rounded-md border border-[#8a6a3c] bg-[#efe3c3] p-2 text-sm">
    <div class="kogge-note">The guild master grants one of these deals per turn.</div>
    {#if bonusGoods.length > 0}
        <div class="flex flex-wrap items-center gap-2">
            <span>Sell six</span>
            {#each bonusGoods as good (good)}
                <button
                    class="kogge-button !px-2 {chosenBonusGood === good
                        ? 'kogge-button-selected'
                        : ''}"
                    onclick={() => (bonusGood = good)}
                >
                    <CubeIcon {good} />
                    {GOOD_ART[good].name}
                </button>
            {/each}
            <span>for a bonus chit:</span>
            {#each availableChits as chit (chit)}
                <button class="kogge-button !px-2" onclick={() => claim(chit)}
                    >{BONUS_CHIT_NAMES[chit]}</button
                >
            {/each}
        </div>
    {/if}
    {#if raidValues.length > 0}
        <div class="flex flex-wrap items-center gap-2">
            <span>Three identical markers for your second raid marker:</span>
            {#each raidValues as value (value)}
                <button
                    class="kogge-button !px-2"
                    onclick={() => gameSession.claimRaidMarker(value)}
                >
                    <ShieldIcon {value} size={18} /><ShieldIcon {value} size={18} /><ShieldIcon
                        {value}
                        size={18}
                    />
                </button>
            {/each}
        </div>
    {/if}
    {#if gameSession.can(ActionType.ExchangeGoodForMarker) && me}
        <div class="flex flex-wrap items-center gap-2">
            <span>Buy a marker for a good of its colour:</span>
            {#each GOODS.filter((good) => me.goods[good] > 0) as good (good)}
                {#each markerValuesForGood(good) as value (value)}
                    <button
                        class="kogge-button !px-1.5 inline-flex items-center"
                        title="Pay one {GOOD_ART[good].name} for a {value}"
                        onclick={() => gameSession.exchangeGoodForMarker(value)}
                    >
                        <CubeIcon {good} size={16} />→<ShieldIcon {value} size={18} />
                    </button>
                {/each}
            {/each}
        </div>
    {/if}
    {#if sellable.length > 0}
        <div class="flex flex-wrap items-center gap-2">
            <span>Sell a marker for a good of its colour:</span>
            {#each sellable as value (value)}
                <button
                    class="kogge-button !px-1.5"
                    onclick={() => gameSession.exchangeMarkerForGood(value)}
                >
                    <ShieldIcon {value} size={18} />
                </button>
            {/each}
        </div>
    {/if}
</div>
