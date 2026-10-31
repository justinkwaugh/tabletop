import { Color } from '@tabletop/common'
import { DefaultColorizer, type PlayerColorPalette } from '@tabletop/frontend-components'

// O-1: the title's four seat colours, green, orange, black and white. None is a
// railroad colour, so a seat is never mistaken for a railroad. Any other colour draws grey.
export const PROMONTORY_POINT_PLAYER_COLOR_PALETTE: PlayerColorPalette = {
    [Color.Green]: { fill: '#3f9a55', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#e07b28', text: '#1d1404', contrast: '#1d1404' },
    [Color.Black]: { fill: '#26272b', text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: '#f4f2ec', text: '#2b2a24', contrast: '#2b2a24' },
    [Color.Gray]: { fill: '#888888', text: '#ffffff', contrast: '#ffffff' }
}

// Tailwind finds only whole class names, so each is written out.
type SeatClasses = { bg: string; text: string; fillText: string; border: string; contrast: string }

const SEAT_CLASSES: Partial<Record<string, SeatClasses>> = {
    [Color.Green]: {
        bg: 'bg-[#3f9a55]',
        text: 'text-[#ffffff]',
        fillText: 'text-[#3f9a55]',
        border: 'border-[#3f9a55]',
        contrast: 'border-[#ffffff]'
    },
    [Color.Orange]: {
        bg: 'bg-[#e07b28]',
        text: 'text-[#1d1404]',
        fillText: 'text-[#e07b28]',
        border: 'border-[#e07b28]',
        contrast: 'border-[#1d1404]'
    },
    [Color.Black]: {
        bg: 'bg-[#26272b]',
        text: 'text-[#ffffff]',
        fillText: 'text-[#26272b]',
        border: 'border-[#26272b]',
        contrast: 'border-[#ffffff]'
    },
    [Color.White]: {
        bg: 'bg-[#f4f2ec]',
        text: 'text-[#2b2a24]',
        fillText: 'text-[#f4f2ec]',
        border: 'border-[#f4f2ec]',
        contrast: 'border-[#2b2a24]'
    }
}

const GREY: SeatClasses = {
    bg: 'bg-[#888888]',
    text: 'text-[#ffffff]',
    fillText: 'text-[#888888]',
    border: 'border-[#888888]',
    contrast: 'border-[#ffffff]'
}

const GREY_FILL = '#888888'

function classesFor(color?: string): SeatClasses {
    return (color === undefined ? undefined : SEAT_CLASSES[color]) ?? GREY
}

export class PromontoryPointGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        const values = Object.entries(PROMONTORY_POINT_PLAYER_COLOR_PALETTE).find(
            ([key]) => key === color
        )?.[1]
        return values?.fill ?? GREY_FILL
    }

    override getBgColor(color?: string): string {
        return classesFor(color).bg
    }

    override getTextColor(color?: string, asPlayerColor: boolean = false): string {
        const classes = classesFor(color)
        return asPlayerColor ? classes.fillText : classes.text
    }

    override getBorderColor(color?: string): string {
        return classesFor(color).border
    }

    override getBorderContrastColor(color?: string): string {
        return classesFor(color).contrast
    }
}
