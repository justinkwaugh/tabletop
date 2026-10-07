import { MediaQuery } from 'svelte/reactivity'

/** A phone held upright: FitBox gives the panel a larger share of the column here. */
export const PHONE_UPRIGHT = '(max-width: 640px) and (orientation: portrait)'

/** A phone held sideways: GameTable hides the information line here. */
export const PHONE_SIDEWAYS = '(max-height: 520px) and (orientation: landscape)'

/** Which phone layout the window is in, if any; read reactively by the components that differ. */
export class PhoneLayout {
    private readonly uprightQuery = new MediaQuery(PHONE_UPRIGHT)
    private readonly sidewaysQuery = new MediaQuery(PHONE_SIDEWAYS)

    get upright(): boolean {
        return this.uprightQuery.current
    }

    get sideways(): boolean {
        return this.sidewaysQuery.current
    }

    get phone(): boolean {
        return this.upright || this.sideways
    }
}
