import { PlayerColor } from '@tabletop/common'

export function uiColorForPlayer(color?: string): string {
    switch (color) {
        case PlayerColor.Blue:
            return '#0d56ad'
        case PlayerColor.Red:
            return '#ad0207'
        case PlayerColor.Yellow:
            return '#fae54b'
        case PlayerColor.Purple:
            return '#9a0ee6'
        default:
            return '#555555'
    }
}

export function uiBgColorForPlayer(color?: string): string {
    switch (color) {
        case PlayerColor.Blue:
            return 'bg-[#0d56ad]'
        case PlayerColor.Red:
            return 'bg-[#ad0207]'
        case PlayerColor.Yellow:
            return 'bg-[#fae54b]'
        case PlayerColor.Purple:
            return 'bg-[#9a0ee6]'
        default:
            return 'bg-[#555555]'
    }
}
