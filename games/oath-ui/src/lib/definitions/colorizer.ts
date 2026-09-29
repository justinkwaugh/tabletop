import { assertExists, Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

type Swatch = { ui: string; bg: string; border: string }

// Tailwind finds classes by scanning the source, so each class is written out whole.
// Gray is the platform's colour for a viewer with no seat; the four colours Oath never
// seats (R-1.8) share one neutral swatch.
const SWATCHES = {
    [Color.Blue]: { ui: '#539ad1', bg: 'bg-[#539ad1]', border: 'border-[#539ad1]' },
    [Color.Red]: { ui: '#e55649', bg: 'bg-[#e55649]', border: 'border-[#e55649]' },
    [Color.Yellow]: { ui: '#f3c244', bg: 'bg-[#f3c244]', border: 'border-[#f3c244]' },
    // Parchment: the Exile boards are cream, and #fff reads as a highlight.
    [Color.White]: { ui: '#e8e0d0', bg: 'bg-[#e8e0d0]', border: 'border-[#e8e0d0]' },
    [Color.Purple]: { ui: '#804796', bg: 'bg-[#804796]', border: 'border-[#804796]' },
    [Color.Black]: { ui: '#444444', bg: 'bg-[#444444]', border: 'border-[#444444]' },
    [Color.Gray]: { ui: '#888888', bg: 'bg-[#888888]', border: 'border-[#888888]' },
    [Color.Orange]: { ui: '#555555', bg: 'bg-[#555555]', border: 'border-[#555555]' },
    [Color.Green]: { ui: '#555555', bg: 'bg-[#555555]', border: 'border-[#555555]' },
    [Color.Pink]: { ui: '#555555', bg: 'bg-[#555555]', border: 'border-[#555555]' },
    [Color.Brown]: { ui: '#555555', bg: 'bg-[#555555]', border: 'border-[#555555]' }
} as const satisfies Record<Color, Swatch>

export class OathGameColorizer extends DefaultColorizer {
    // R-1.8, R-1.9 — a seat's colour is a rule fact, so a palette swap would part the seat from its pieces.
    override allowPreferredPlayerColors(): boolean {
        return false
    }

    override supportsColorblindPalette(): boolean {
        return false
    }

    override getUiColor(color?: Color): string {
        return this.swatchOf(color).ui
    }

    // R-1.9 — two of the five Exile boards are pale, so white text is unreadable on them.
    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (!asPlayerColor && (color === Color.White || color === Color.Yellow)) {
            return 'text-black'
        }
        return super.getTextColor(color, asPlayerColor)
    }

    override getBgColor(color?: Color): string {
        return this.swatchOf(color).bg
    }

    override getBorderColor(color?: Color): string {
        return this.swatchOf(color).border
    }

    private swatchOf(color: Color | undefined): Swatch {
        assertExists(color, 'Every seat and every viewer has a colour')
        return SWATCHES[color]
    }
}
