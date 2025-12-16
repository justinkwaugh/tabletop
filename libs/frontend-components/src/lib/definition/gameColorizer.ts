import { Color } from '@tabletop/common'

export interface GameColorizer {
    getUiColor(color?: Color): string
    getBgColor(color?: Color): string
    getTextColor(color?: Color, asPlayerColor?: boolean): string
    getBorderColor(color?: Color): string
    getBorderContrastColor(color?: Color): string
}

const uiColorForColor = {
    [Color.Red]: 'red-700',
    [Color.Orange]: 'orange-500',
    [Color.Yellow]: 'yellow-300',
    [Color.Green]: 'green-600',
    [Color.Blue]: 'blue-600',
    [Color.Purple]: 'purple-600',
    [Color.Pink]: 'pink-500',
    [Color.Brown]: 'yellow-900',
    [Color.Gray]: 'gray-500',
    [Color.Black]: 'black',
    [Color.White]: 'white'
}

const bgColorForColor = {
    [Color.Red]: 'bg-red-700',
    [Color.Orange]: 'bg-orange-500',
    [Color.Yellow]: 'bg-yellow-300',
    [Color.Green]: 'bg-green-600',
    [Color.Blue]: 'bg-blue-600',
    [Color.Purple]: 'bg-purple-600',
    [Color.Pink]: 'bg-pink-500',
    [Color.Brown]: 'bg-yellow-900',
    [Color.Gray]: 'bg-gray-500',
    [Color.Black]: 'bg-black',
    [Color.White]: 'bg-white'
}

const borderColorForColor = {
    [Color.Red]: 'border-red-700',
    [Color.Orange]: 'border-orange-500',
    [Color.Yellow]: 'border-yellow-300',
    [Color.Green]: 'border-green-600',
    [Color.Blue]: 'border-blue-600',
    [Color.Purple]: 'border-purple-600',
    [Color.Pink]: 'border-pink-500',
    [Color.Brown]: 'border-yellow-900',
    [Color.Gray]: 'border-gray-500',
    [Color.Black]: 'border-black',
    [Color.White]: 'border-white'
}

const textColorForColor = {
    [Color.Red]: 'text-red-700',
    [Color.Orange]: 'text-orange-500',
    [Color.Yellow]: 'text-yellow-300',
    [Color.Green]: 'text-green-600',
    [Color.Blue]: 'text-blue-600',
    [Color.Purple]: 'text-purple-600',
    [Color.Pink]: 'text-pink-500',
    [Color.Brown]: 'text-yellow-900',
    [Color.Gray]: 'text-gray-500',
    [Color.Black]: 'text-black',
    [Color.White]: 'text-white'
}

export class DefaultColorizer implements GameColorizer {
    getUiColor(color?: Color): string {
        return uiColorForColor[color ?? Color.Black]
    }
    getBgColor(color?: Color): string {
        return bgColorForColor[color ?? Color.Black]
    }
    getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor) {
            return textColorForColor[color ?? Color.Black]
        } else {
            return color === Color.Yellow ? 'text-black' : 'text-white'
        }
    }
    getBorderColor(color?: Color): string {
        return borderColorForColor[color ?? Color.Black] ?? 'border-color-black'
    }
    getBorderContrastColor(color?: Color): string {
        return color === Color.Yellow ? 'border-black' : 'border-white'
    }
}
