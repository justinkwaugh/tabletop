import { HydratedSolGameState, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'

export class CardPickerAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(
        gameSession: SolGameSession,
        private playerId: string
    ) {
        super(gameSession)
    }

    override onAttach(): void {}

    override async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        timeline: gsap.core.Timeline
    }) {}
}
