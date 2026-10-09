import { BonusChit } from '@tabletop/kogge'
import { Color } from '@tabletop/common'
import board from '$lib/images/redesign/board.webp'
import tile0 from '$lib/images/redesign/tile-0.webp'
import tile1 from '$lib/images/redesign/tile-1.webp'
import tile2 from '$lib/images/redesign/tile-2.webp'
import tile3 from '$lib/images/redesign/tile-3.webp'
import tile4 from '$lib/images/redesign/tile-4.webp'
import tile5 from '$lib/images/redesign/tile-5.webp'
import tile6 from '$lib/images/redesign/tile-6.webp'
import tile7 from '$lib/images/redesign/tile-7.webp'
import tile8 from '$lib/images/redesign/tile-8.webp'
import tileBack from '$lib/images/redesign/tile-back.webp'
import bonusExtraRouteMarker from '$lib/images/redesign/bonus-extra-route-marker.webp'
import bonusMoveTwo from '$lib/images/redesign/bonus-move-two.webp'
import bonusSecretPassage from '$lib/images/redesign/bonus-secret-passage.webp'
import bonusThreeForOne from '$lib/images/redesign/bonus-three-for-one.webp'
import raidBlue from '$lib/images/redesign/raid-blue.webp'
import raidGreen from '$lib/images/redesign/raid-green.webp'
import raidRed from '$lib/images/redesign/raid-red.webp'
import raidYellow from '$lib/images/redesign/raid-yellow.webp'

export const REDESIGN_BOARD = board
export const ROUTE_TILE_BACK = tileBack
export const ROUTE_TILES: readonly string[] = [
    tile0,
    tile1,
    tile2,
    tile3,
    tile4,
    tile5,
    tile6,
    tile7,
    tile8
]

export const BONUS_TILES: Record<BonusChit, string> = {
    [BonusChit.ExtraRouteMarker]: bonusExtraRouteMarker,
    [BonusChit.MoveTwo]: bonusMoveTwo,
    [BonusChit.SecretPassage]: bonusSecretPassage,
    [BonusChit.ThreeForOne]: bonusThreeForOne
}

const RAID_CHITS: Partial<Record<Color, string>> = {
    [Color.Blue]: raidBlue,
    [Color.Green]: raidGreen,
    [Color.Red]: raidRed,
    [Color.Yellow]: raidYellow
}

export function raidChit(color: Color): string | undefined {
    return RAID_CHITS[color]
}
