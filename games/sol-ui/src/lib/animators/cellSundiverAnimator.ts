import { HydratedSolGameState, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { OffsetCoordinates } from '@tabletop/common'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeIn, fadeOut } from '$lib/utils/animations.js'
import { gsap } from 'gsap'

export class CellSundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(
        gameSession: SolGameSession,
        private playerId: string,
        private coords: OffsetCoordinates
    ) {
        super(gameSession)
    }

    override onAttach(): void {
        // console.log('CellSundiverAnimator attached for player', this.playerId, 'at', this.coords)
        gsap.set(this.element!, { opacity: 0 })
        fadeIn({
            object: this.element,
            duration: 0.2
        })
    }

    override async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        timeline: gsap.core.Timeline
    }) {
        if (!this.element) {
            return
        }

        const toCell = to.board.cellAt(this.coords)
        const fromCell = from?.board.cellAt(this.coords)
        if (!toCell && !fromCell) {
            return
        }

        const toDivers = to.board.sundiversForPlayerAt(this.playerId, this.coords)
        const fromDivers = from?.board.sundiversForPlayerAt(this.playerId, this.coords) ?? []

        if (toDivers.length === fromDivers.length) {
            return
        }

        if (toDivers.length === 0) {
            fadeOut({
                object: this.element,
                duration: 0.2,
                timeline,
                position: 'cellsFadeOut'
            })
        } else if (fromDivers.length === 0) {
            gsap.set(this.element, { opacity: 0 })
            fadeIn({
                object: this.element,
                duration: 0.3,
                timeline,
                position: 'cellsFadeIn'
            })
        }
    }
}
