import { DefaultColorizer } from '@tabletop/frontend-components'

export class YGameColorizer extends DefaultColorizer {
    // The players are the black and white stones, whatever colour they prefer.
    override allowPreferredPlayerColors(): boolean {
        return false
    }
}
