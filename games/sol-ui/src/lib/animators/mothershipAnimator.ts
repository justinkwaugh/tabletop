import { HydratedSolGameState, type SolGameState, type Sundiver } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { Color, sameCoordinates, type Point } from '@tabletop/common'
import { getCellLayout } from '$lib/utils/cellLayouts.js'
import {
    CENTER_POINT,
    getMothershipAngle,
    getMothershipSpotPoint,
    offsetFromCenter
} from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { move, rotate } from '$lib/utils/animations.js'
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
