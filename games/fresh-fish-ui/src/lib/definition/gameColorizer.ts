import { PlayerColor } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class FreshFishColorizer extends DefaultColorizer {
    override getUiColor(playerColor: PlayerColor): string {
        switch (playerColor) {
            case PlayerColor.Blue:
                return '#0d56ad'
            case PlayerColor.Red:
                return '#ad0207'
            case PlayerColor.Green:
                return '#016e0a'
            case PlayerColor.Yellow:
                return '#fae54b'
            case PlayerColor.Purple:
                return '#9a0ee6'
            default:
                return '#555555'
        }
    }

    override getBgColor(playerColor: PlayerColor): string {
        switch (playerColor) {
            case PlayerColor.Blue:
                return 'bg-[#0d56ad]'
            case PlayerColor.Red:
                return 'bg-[#ad0207]'
            case PlayerColor.Green:
                return 'bg-[#016e0a]'
            case PlayerColor.Yellow:
                return 'bg-[#fae54b]'
            case PlayerColor.Purple:
                return 'bg-[#9a0ee6]'
            default:
                return 'bg-[#555555]'
        }
    }
}
