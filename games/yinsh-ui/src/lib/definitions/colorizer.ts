import { DefaultColorizer } from '@tabletop/frontend-components'

export class YinshGameColorizer extends DefaultColorizer {
    // The players are the printed white and black pieces, whatever colour they prefer.
    override allowPreferredPlayerColors(): boolean {
        return false
    }
}
