<script lang="ts">
    import cheeseStallImg from '$lib/images/cheese-stall.png'
    import fishStallImg from '$lib/images/fish-stall.png'
    import gelatoStallImg from '$lib/images/gelato-stall.png'
    import sodaStallImg from '$lib/images/soda-stall.png'
    import cheeseStallDarkImg from '$lib/images/cheese-stall-dark.png'
    import fishStallDarkImg from '$lib/images/fish-stall-dark.png'
    import gelatoStallDarkImg from '$lib/images/gelato-stall-dark.png'
    import sodaStallDarkImg from '$lib/images/soda-stall-dark.png'
    import { GoodsType } from '@tabletop/fresh-fish'
    import { Color } from '@tabletop/common'
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'

    let {
        size = 100,
        playerId,
        goodsType
    }: { size?: number; playerId?: string; goodsType?: GoodsType } = $props()

    let gameSession = getContext('gameSession') as FreshFishGameSession

    let sizePx = $derived(`${size}px`)
    let stallBgColor = $derived(
        playerId ? gameSession.colors.getPlayerBgColor(playerId) : 'bg-[#555555]'
    )
    let playerColor = $derived(gameSession.colors.getPlayerColor(playerId))
    let stallImg = $derived.by(() => {
        switch (goodsType) {
            case GoodsType.Cheese:
                return playerColor === Color.Yellow ? cheeseStallDarkImg : cheeseStallImg
            case GoodsType.Fish:
                return playerColor === Color.Yellow ? fishStallDarkImg : fishStallImg
            case GoodsType.IceCream:
                return playerColor === Color.Yellow ? gelatoStallDarkImg : gelatoStallImg
            case GoodsType.Lemonade:
                return playerColor === Color.Yellow ? sodaStallDarkImg : sodaStallImg
            default:
                return undefined
        }
    })
</script>

<div
    class="stall-tile flex justify-center align-center bg-contain bg-origin-border {stallBgColor}"
    style="min-width:{sizePx};width:{sizePx};min-height:{sizePx};height:{sizePx};"
>
    <img src={stallImg} alt="stall" />
</div>
