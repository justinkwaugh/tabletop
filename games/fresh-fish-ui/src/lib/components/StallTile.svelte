<script lang="ts">
    import cheeseStallImg from '$lib/images/cheese-stall.png'
    import fishStallImg from '$lib/images/fish-stall.png'
    import gelatoStallImg from '$lib/images/gelato-stall.png'
    import sodaStallImg from '$lib/images/soda-stall.png'
    import cheeseStallDarkImg from '$lib/images/cheese-stall-dark.png'
    import fishStallDarkImg from '$lib/images/fish-stall-dark.png'
    import gelatoStallDarkImg from '$lib/images/gelato-stall-dark.png'
    import sodaStallDarkImg from '$lib/images/soda-stall-dark.png'
    import { uiBgColorForPlayer } from '$lib/utils/playerColors'
    import { GoodsType, PlayerColor } from '@tabletop/fresh-fish'
    import { fadeScale, type FadeScaleParams } from '@tabletop/frontend-components'
    import { fade } from 'svelte/transition'

    let {
        size = 100,
        playerColor = '',
        goodsType
    }: { size?: number; playerColor: string; goodsType?: GoodsType } = $props()

    let sizePx = $derived(`${size}px`)
    let stallBgColor = $derived(uiBgColorForPlayer(playerColor))
    let stallImg = $derived.by(() => {
        switch (goodsType) {
            case GoodsType.Cheese:
                return playerColor === PlayerColor.Yellow ? cheeseStallDarkImg : cheeseStallImg
            case GoodsType.Fish:
                return playerColor === PlayerColor.Yellow ? fishStallDarkImg : fishStallImg
            case GoodsType.IceCream:
                return playerColor === PlayerColor.Yellow ? gelatoStallDarkImg : gelatoStallImg
            case GoodsType.Lemonade:
                return playerColor === PlayerColor.Yellow ? sodaStallDarkImg : sodaStallImg
            default:
                return undefined
        }
    })
</script>

<div
    class="stall-tile flex justify-center align-center bg-contain bg-origin-border {stallBgColor} border-2 border-gray-900"
    style="min-width:{sizePx};width:{sizePx};min-height:{sizePx};height:{sizePx};"
>
    <img src={stallImg} alt="stall" />
</div>
