import { PlayerColor } from '@tabletop/common'

export interface GameColorizer {
    getUiColor(playerColor?: PlayerColor): string
    getBgColor(playerColor?: PlayerColor): string
    getTextColor(playerColor?: PlayerColor): string
    getBorderColor(playerColor?: PlayerColor): string
}
const uiColorForPlayerColor = {
    [PlayerColor.Red]: 'red-700',
    [PlayerColor.Orange]: 'orange-500',
    [PlayerColor.Yellow]: 'yellow-300',
    [PlayerColor.Green]: 'green-600',
    [PlayerColor.Blue]: 'blue-600',
    [PlayerColor.Purple]: 'purple-600',
    [PlayerColor.Pink]: 'pink-500',
    [PlayerColor.Brown]: 'yellow-900',
    [PlayerColor.Gray]: 'gray-500',
    [PlayerColor.Black]: 'black',
    [PlayerColor.White]: 'white'
}

const bgColorForPlayerColor = {
    [PlayerColor.Red]: 'bg-red-700',
    [PlayerColor.Orange]: 'bg-orange-500',
    [PlayerColor.Yellow]: 'bg-yellow-300',
    [PlayerColor.Green]: 'bg-green-600',
    [PlayerColor.Blue]: 'bg-blue-600',
    [PlayerColor.Purple]: 'bg-purple-600',
    [PlayerColor.Pink]: 'bg-pink-500',
    [PlayerColor.Brown]: 'bg-yellow-900',
    [PlayerColor.Gray]: 'bg-gray-500',
    [PlayerColor.Black]: 'bg-black',
    [PlayerColor.White]: 'bg-white'
}

const borderColorForPlayerColor = {
    [PlayerColor.Red]: 'bg-red-700',
    [PlayerColor.Orange]: 'bg-orange-500',
    [PlayerColor.Yellow]: 'bg-yellow-300',
    [PlayerColor.Green]: 'bg-green-600',
    [PlayerColor.Blue]: 'bg-blue-600',
    [PlayerColor.Purple]: 'bg-purple-600',
    [PlayerColor.Pink]: 'bg-pink-500',
    [PlayerColor.Brown]: 'bg-yellow-900',
    [PlayerColor.Gray]: 'bg-gray-500',
    [PlayerColor.Black]: 'bg-black',
    [PlayerColor.White]: 'bg-white'
}

export class DefaultColorizer implements GameColorizer {
    getUiColor(playerColor?: PlayerColor): string {
        return uiColorForPlayerColor[playerColor ?? PlayerColor.Black]
    }
    getBgColor(playerColor?: PlayerColor): string {
        return bgColorForPlayerColor[playerColor ?? PlayerColor.Black]
    }
    getTextColor(playerColor?: PlayerColor): string {
        return playerColor === PlayerColor.Yellow ? 'text-black' : 'text-white'
    }
    getBorderColor(playerColor?: PlayerColor): string {
        return borderColorForPlayerColor[playerColor ?? PlayerColor.Black] ?? 'border-color-black'
    }
}
