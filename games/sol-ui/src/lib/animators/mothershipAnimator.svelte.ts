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
    animating = $state(false)
    private color: Color
    private index?: number
    private timeline?: gsap.core.Timeline

    constructor(
        gameSession: SolGameSession,
        private playerId: string
    ) {
        super(gameSession)
        this.color = gameSession.gameState.getPlayerState(playerId).color
    }

    setIndex(
        index: number,
        direction?: Direction.Clockwise | Direction.CounterClockwise | undefined,
        timeline?: gsap.core.Timeline | undefined
    ) {
        const priorIndex = this.index
        if (index === priorIndex) {
            return
        }

        const numSpots = this.gameSession.gameState.board.numMothershipLocations
        while (index < 0) {
            index += numSpots
        }

        this.index = index % numSpots

        if (!direction) {
            if (this.index === numSpots - 1 && priorIndex === 0) {
                direction = Direction.CounterClockwise
            } else if (priorIndex === numSpots - 1 && this.index === 0) {
                direction = Direction.Clockwise
            } else {
                direction =
                    this.index < (priorIndex ?? 0)
                        ? Direction.CounterClockwise
                        : Direction.Clockwise
            }
        }

        this.moveShip({
            from: priorIndex ?? 0,
            to: this.index,
            direction,
            timeline
        })
    }

    override onAttach(): void {
        // Could fade in here
        this.index = this.gameSession.gameState.board.motherships[this.playerId]
        const degrees = getMothershipAngle(this.gameSession.numPlayers, this.color, this.index)
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
        const direction =
            to.actionCount >= (from?.actionCount ?? 0)
                ? Direction.CounterClockwise
                : Direction.Clockwise

        const endIndex = to.board.motherships[this.playerId]
        this.setIndex(endIndex, direction, animationContext.finalTimeline)
    }

    moveShip({
        timeline,
        from,
        to,
        direction = Direction.CounterClockwise
    }: {
        timeline?: gsap.core.Timeline
        from: number
        to: number
        direction: Direction.Clockwise | Direction.CounterClockwise
    }) {
        // console.log('animating ship from ', from, 'to', to)
        const currentRotation = this.element
            ? Number(gsap.getProperty(this.element, 'rotation'))
            : NaN
        let startDegrees = Number.isFinite(currentRotation)
            ? currentRotation
            : getMothershipAngle(this.gameSession.numPlayers, this.color, from)
        const endDegrees = getMothershipAngle(this.gameSession.numPlayers, this.color, to)

        if (direction === Direction.CounterClockwise && startDegrees < endDegrees) {
            startDegrees += 360
        } else if (direction === Direction.Clockwise && startDegrees > endDegrees) {
            startDegrees -= 360
        }
        gsap.set(this.element!, {
            rotation: startDegrees
        })
        if (this.timeline) {
            this.timeline.kill()
            this.timeline = undefined
        }

        this.timeline = rotate({
            timeline,
            object: this.element,
            degrees: `${endDegrees}`,
            svgOrigin: SVG_ORIGIN,
            duration: 0.5 + 0.1 * (Math.abs(endDegrees - startDegrees) / 72),
            position: 0,
            onStart: () => {
                this.animating = true
            },
            onComplete: () => {
                this.timeline = undefined
                this.animating = false
            }
        })
    }
}

export function animateMothership(
    node: HTMLElement | SVGElement,
    params: { animator: MothershipAnimator; index: number }
):
    | {
          update: (params: { animator: MothershipAnimator; index: number }) => void
          destroy: () => void
      }
    | undefined {
    params.animator.setElement(node)
    params.animator.onAttach()
    params.animator.register()
    return {
        update(updateParams: { animator: MothershipAnimator; index: number }) {
            updateParams.animator.setIndex(updateParams.index)
        },
        destroy() {
            params.animator.setElement(undefined)
            params.animator.unregister()
        }
    }
}
