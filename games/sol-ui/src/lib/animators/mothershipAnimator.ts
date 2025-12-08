import { Direction, HydratedSolGameState, type SolGameState } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { Color, GameAction } from '@tabletop/common'
import { CENTER_POINT, getMothershipAngle } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { rotate } from '$lib/utils/animations.js'
import { gsap } from 'gsap'

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
        timeline,
        finalTimeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        timeline: gsap.core.Timeline
        finalTimeline: gsap.core.Timeline
    }) {
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
            this.moveShip(finalTimeline, startIndex, endIndex, direction)
        }
    }

    moveShip(
        timeline: gsap.core.Timeline,
        startIndex: number,
        endIndex: number,
        direction: Direction.Clockwise | Direction.CounterClockwise = Direction.CounterClockwise
    ) {
        const startDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, startIndex)
        const endDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, endIndex)

        if (direction === Direction.CounterClockwise && startDegrees < endDegrees) {
            gsap.set(this.element!, {
                rotation: startDegrees + 360
            })
        } else if (direction === Direction.Clockwise && startDegrees > endDegrees) {
            gsap.set(this.element!, {
                rotation: startDegrees - 360
            })
        }

        rotate({
            timeline,
            object: this.element,
            degrees: `${endDegrees}`,
            svgOrigin: SVG_ORIGIN,
            duration: 0.5,
            position: 0
        })
    }
}
