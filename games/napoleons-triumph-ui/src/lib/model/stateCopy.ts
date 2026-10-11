import { HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'

export function copyOf(
    state: HydratedNapoleonsTriumphGameState
): HydratedNapoleonsTriumphGameState {
    return new HydratedNapoleonsTriumphGameState(structuredClone(state.dehydrate()))
}
