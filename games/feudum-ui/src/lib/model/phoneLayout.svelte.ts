import { MediaQuery } from 'svelte/reactivity'

/** Below Tailwind's `sm`, where the shared layout's `max-sm:` classes apply. */
const PhoneUpright = '(width < 40rem)'
const PhoneSideways = '(max-height: 520px) and (orientation: landscape)'
const ReducedMotion = '(prefers-reduced-motion: reduce)'

export class PhoneLayout {
    private readonly uprightQuery = new MediaQuery(PhoneUpright)
    private readonly sidewaysQuery = new MediaQuery(PhoneSideways)
    private readonly motionQuery = new MediaQuery(ReducedMotion)

    get upright(): boolean {
        return this.uprightQuery.current
    }

    get sideways(): boolean {
        return !this.upright && this.sidewaysQuery.current
    }

    get phone(): boolean {
        return this.upright || this.sideways
    }

    get reducedMotion(): boolean {
        return this.motionQuery.current
    }
}
