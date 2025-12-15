import { Direction, HydratedSolGameState, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { Color, GameAction } from '@tabletop/common'
import { CENTER_POINT, getMothershipAngle } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { rotate } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import type { AnimationContext } from '@tabletop/frontend-components'

const SVG_ORIGIN = `${CENTER_POINT.x}, ${CENTER_POINT.y}`
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
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        console.log('handling mothership animation for action', action)
        const direction =
            to.actionCount >= (from?.actionCount ?? 0)
                ? Direction.CounterClockwise
                : Direction.Clockwise
        const startIndex = from?.board.motherships[this.playerId]
        if (startIndex === undefined) {
            return
        }
        const endIndex = to.board.motherships[this.playerId]
        if (startIndex !== endIndex) {
            this.moveShip(animationContext.finalTimeline, startIndex, endIndex, direction)
        }
    }

    moveShip(
        timeline: gsap.core.Timeline,
        startIndex: number,
        endIndex: number,
        direction: Direction.Clockwise | Direction.CounterClockwise = Direction.CounterClockwise
    ) {
        console.log(
            `Moving mothership ${this.playerId} from ${startIndex} to ${endIndex} in direction ${direction}`
        )
        let startDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, startIndex)
        const endDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, endIndex)

        console.log(`Rotating from ${startDegrees} to ${endDegrees}`)

        if (direction === Direction.CounterClockwise && startDegrees < endDegrees) {
            startDegrees += 360
        } else if (direction === Direction.Clockwise && startDegrees > endDegrees) {
            startDegrees -= 360
        }
        gsap.set(this.element!, {
            rotation: startDegrees
        })
        rotate({
            timeline,
            object: this.element,
            degrees: `${endDegrees}`,
            svgOrigin: SVG_ORIGIN,
            duration: 0.5 + 0.1 * (Math.abs(endDegrees - startDegrees) / 72),
            position: 0
        })
    }
}
