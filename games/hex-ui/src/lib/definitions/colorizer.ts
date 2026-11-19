import { DefaultColorizer } from '@tabletop/frontend-components'

export class HexGameColorizer extends DefaultColorizer {
    // The players are the red and blue sides of the board, whatever colour they prefer.
    override allowPreferredPlayerColors(): boolean {
        return false
    }
}
