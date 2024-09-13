import { GoodsType } from '@tabletop/fresh-fish'

export function getGoodsName(goodsType: string): string {
    switch (goodsType) {
        case GoodsType.Cheese:
            return 'cheese'
        case GoodsType.Fish:
            return 'fish'
        case GoodsType.IceCream:
            return 'gelato'
        case GoodsType.Lemonade:
            return 'soda'
        default:
            return ''
    }
}
