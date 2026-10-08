export enum BonusChit {
    ThreeForOne = 'ThreeForOne',
    ExtraRouteMarker = 'ExtraRouteMarker',
    MoveTwo = 'MoveTwo',
    SecretPassage = 'SecretPassage'
}

export const BONUS_CHITS: readonly BonusChit[] = [
    BonusChit.ThreeForOne,
    BonusChit.ExtraRouteMarker,
    BonusChit.MoveTwo,
    BonusChit.SecretPassage
]

export const COPIES_PER_BONUS_CHIT = 2
export const GOODS_PER_BONUS_CHIT = 6
