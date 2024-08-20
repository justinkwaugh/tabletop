<script lang="ts">
    import cheeseTruckImg from '$lib/images/cheese-truck.png'
    import fishTruckImg from '$lib/images/fish-truck.png'
    import sodaTruckImg from '$lib/images/soda-truck.png'
    import gelatoTruckImg from '$lib/images/gelato-truck.png'
    import { GoodsType } from '@tabletop/fresh-fish'

    let { goodsType }: { goodsType?: GoodsType } = $props()

    let truckImg = $derived.by(() => {
        switch (goodsType) {
            case GoodsType.Cheese:
                return cheeseTruckImg
            case GoodsType.Fish:
                return fishTruckImg
            case GoodsType.IceCream:
                return gelatoTruckImg
            case GoodsType.Lemonade:
                return sodaTruckImg
            default:
                return undefined
        }
    })
</script>

<div
    class="w-[100px] h-[100px] min-w-[100px] min-h-[100px] flex justify-center align-center bg-contain bg-origin-border"
>
    <img src={truckImg} alt="truck" />
</div>
