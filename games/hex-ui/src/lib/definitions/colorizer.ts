import { DefaultColorizer } from '@tabletop/frontend-components'

export class HexGameColorizer extends DefaultColorizer {
    // The players are the red and blue sides of the board, whatever colour they prefer.
    override allowPreferredPlayerColors(): boolean {
        return false
    }

    // The board's own black and white toggle stands in for the site's colourblind palette, which
    // would recolour the cards but not the stones.
    override supportsColorblindPalette(): boolean {
        return false
    }
}
