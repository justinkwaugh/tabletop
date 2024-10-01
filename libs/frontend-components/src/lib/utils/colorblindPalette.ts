import type { GameColorizer } from '$lib/definition/gameColorizer'
import { Color } from '@tabletop/common'

export enum ColorblindColor {
    Black = '#000000',
    White = '#FFFFFF',
    Gray = '#888888',
    Brown = '#444444',
    Orange = '#E69F00',
    SkyBlue = '#56B4E9',
    BluishGreen = '#009E73',
    Yellow = '#F0E442',
    Blue = '#0072B2',
    Vermilion = '#D55E00',
    ReddishPurple = '#CC79A7'
}

const colorBlindColorForColor = {
    [Color.Red]: ColorblindColor.Vermilion,
    [Color.Orange]: ColorblindColor.Orange,
    [Color.Yellow]: ColorblindColor.Yellow,
    [Color.Green]: ColorblindColor.BluishGreen,
    [Color.Blue]: ColorblindColor.Blue,
    [Color.Purple]: ColorblindColor.ReddishPurple,
    [Color.Pink]: ColorblindColor.SkyBlue,
    [Color.Brown]: ColorblindColor.Brown,
    [Color.Gray]: ColorblindColor.Gray,
    [Color.White]: ColorblindColor.White,
    [Color.Black]: ColorblindColor.Black
}

// This is so tailwind can compile the definition
const bgColorForColor = {
    [ColorblindColor.Black]: `bg-[#000000]`,
    [ColorblindColor.White]: `bg-[#FFFFFF]`,
    [ColorblindColor.Gray]: `bg-[#888888]`,
    [ColorblindColor.Brown]: `bg-[#444444]`,
    [ColorblindColor.Orange]: `bg-[#E69F00]`,
    [ColorblindColor.SkyBlue]: `bg-[#56B4E9]`,
    [ColorblindColor.BluishGreen]: `bg-[#009E73]`,
    [ColorblindColor.Yellow]: `bg-[#F0E442]`,
    [ColorblindColor.Blue]: `bg-[#0072B2]`,
    [ColorblindColor.Vermilion]: `bg-[#D55E00]`,
    [ColorblindColor.ReddishPurple]: `bg-[#CC79A7]`
}

const borderColorForColor = {
    [ColorblindColor.Black]: `border-[#000000]`,
    [ColorblindColor.White]: `border-[#FFFFFF]`,
    [ColorblindColor.Gray]: `border-[#888888]`,
    [ColorblindColor.Brown]: `border-[#444444]`,
    [ColorblindColor.Orange]: `border-[#E69F00]`,
    [ColorblindColor.SkyBlue]: `border-[#56B4E9]`,
    [ColorblindColor.BluishGreen]: `border-[#009E73]`,
    [ColorblindColor.Yellow]: `border-[#F0E442]`,
    [ColorblindColor.Blue]: `border-[#0072B2]`,
    [ColorblindColor.Vermilion]: `border-[#D55E00]`,
    [ColorblindColor.ReddishPurple]: `border-[#CC79A7]`
}

export class ColorblindColorizer implements GameColorizer {
    getUiColor(color?: Color): string {
        return colorBlindColorForColor[color ?? Color.Black]
    }
    getBgColor(color?: Color): string {
        return bgColorForColor[colorBlindColorForColor[color ?? Color.Black]]
    }
    getTextColor(color: Color): string {
        return color === Color.Yellow ? 'text-black' : 'text-white'
    }
    getBorderColor(color: Color): string {
        return borderColorForColor[colorBlindColorForColor[color ?? Color.Black]]
    }
    getBorderContrastColor(color: Color): string {
        return color === Color.Yellow ? 'border-black' : 'border-white'
    }
}
