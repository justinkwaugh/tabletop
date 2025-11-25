import { HydratedSolGameState, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { Color } from '@tabletop/common'
import { CENTER_POINT, getMothershipAngle } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { rotate } from '$lib/utils/animations.js'
import { gsap } from 'gsap'

export class MothershipAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private color: Color

    constructor(
        gameSession: SolGameSession,
        private playerId: string
    ) {
        super(gameSession)
        this.color = gameSession.gameState.getPlayerState(playerId).color
    }

    override onAttach(): void {
        // Could fade in here
        const currentIndex = this.gameSession.gameState.board.motherships[this.playerId]
        const degrees = getMothershipAngle(this.gameSession.numPlayers, this.color, currentIndex)
        const svgOrigin = `${CENTER_POINT.x}, ${CENTER_POINT.y}`
        gsap.set(this.element!, {
            rotation: degrees,
            svgOrigin
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
        const startIndex = from?.board.motherships[this.playerId]
        if (!startIndex) {
            return
        }
        const endIndex = to.board.motherships[this.playerId]
        if (startIndex !== endIndex) {
            this.moveShip(timeline as gsap.core.Timeline, startIndex, endIndex)
        }
    }

    moveShip(timeline: gsap.core.Timeline, startIndex: number, endIndex: number) {
        const endDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, endIndex)

        rotate({
            timeline,
            object: this.element,
            degrees: `${endDegrees}`,
            svgOrigin: `${CENTER_POINT.x}, ${CENTER_POINT.y}`,
            duration: 0.5,
            position: 'mothership'
        })
    }
}
