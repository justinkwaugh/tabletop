import { PlayerColor } from '@tabletop/common'

export function uiColorForPlayer(color?: string): string {
    switch (color) {
        case PlayerColor.Blue:
            return '#0d56ad'
        case PlayerColor.Red:
            return '#c14239'
        case PlayerColor.Yellow:
            return '#ffee86'
        case PlayerColor.Green:
            return '#016e0a'
        default:
            return '#555555'
    }
}

export function uiBgColorForPlayer(color?: string): string {
    switch (color) {
        case PlayerColor.Blue:
            return 'bg-[#0d56ad]'
        case PlayerColor.Red:
            return 'bg-[#c14239]'
        case PlayerColor.Yellow:
            return 'bg-[#ffee86]'
        case PlayerColor.Green:
            return 'bg-[#016e0a]'
        default:
            return 'bg-[#555555]'
    }
}
