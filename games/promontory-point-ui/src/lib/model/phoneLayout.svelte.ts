import { MediaQuery } from 'svelte/reactivity'

// Below Tailwind's `sm` breakpoint, where the `max-sm:` classes and the phone layout apply.
export const PHONE_QUERY = '(width < 40rem)'

// Contract, "Phone layout": read reactively by the parts that only a phone needs, such as the
// board's resting frame and the pick framing.
export class PhoneLayout {
    private readonly query = new MediaQuery(PHONE_QUERY)

    get phone(): boolean {
        return this.query.current
    }
}
