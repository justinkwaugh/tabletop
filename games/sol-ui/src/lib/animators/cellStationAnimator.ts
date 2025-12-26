import {
    CENTER_COORDS,
    Convert,
    Fly,
    Hurl,
    HydratedSolGameState,
    isConvert,
    isFly,
    isHurl,
    isMetamorphosize,
    Metamorphosize,
    Station,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import {
    Point,
    sameCoordinates,
    samePoint,
    type GameAction,
    type OffsetCoordinates
} from '@tabletop/common'
import { animate, call, fadeIn, fadeOut, move } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPath } from '$lib/utils/flight.js'

export class CellStationAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private station?: Station
    private clipRect?: SVGRectElement

    constructor(
        gameSession: SolGameSession,
        private coords: OffsetCoordinates,
        private callback?: (station?: Station, location?: Point) => void
    ) {
        super(gameSession)
    }

    addStation(
        station: Station,
        element: HTMLElement | SVGElement,
        clipRect?: SVGRectElement
    ): void {
        // console.log('adding cell station')
        this.station = station
        this.setElement(element)
        this.setClipRect(clipRect)
    }

    removeStation(): void {
        delete this.station
        this.setElement(undefined)
        this.setClipRect(undefined)
    }

    setClipRect(clipRect?: SVGRectElement): void {
        this.clipRect = clipRect
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
        if (isConvert(action)) {
            await this.animateConvert(action, animationContext.actionTimeline, to, from)
        } else if (isFly(action) || isHurl(action)) {
            await this.animateFlyOrHurlAction(action, animationContext.actionTimeline, to, from)
        } else if (isMetamorphosize(action)) {
            await this.animateMetamorphosize(action, animationContext, to, from)
        } else {
            const toBoard = to.board
            const fromBoard = from?.board
            const toCell = toBoard.cellAt(this.coords)
            const fromCell = fromBoard?.cellAt(this.coords)

            const toStation = toCell.station
            const fromStation = fromCell?.station

            if (fromStation && !toStation) {
                fadeOut({
                    object: this.element!,
                    timeline: animationContext.actionTimeline,
                    duration: 0.3
                })
            } else if (toStation && !fromStation) {
                fadeIn({
                    object: this.element!,
                    timeline: animationContext.actionTimeline,
                    duration: 0.3
                })
            } else if (fromCell && toCell) {
                const fromLocation = this.gameSession.locationForStationInCell(fromCell)
                const toLocation = this.gameSession.locationForStationInCell(toCell)
                if (!samePoint(fromLocation, toLocation)) {
                    move({
                        object: this.element,
                        timeline: animationContext.actionTimeline,
                        location: offsetFromCenter(toLocation),
                        ease: 'power2.inOut',
                        duration: 1,
                        position: 0
                    })
                }
            }
        }
    }

    async animateConvert(
        action: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || action.isGate || !sameCoordinates(action.coords, this.coords)) {
            return
        }

        const location = this.gameSession.locationForStationInCell(
            toState.board.cellAt(this.coords)
        )

        // Trigger rendering/attachment of the converted station
        if (this.callback) {
            this.callback(action.metadata?.convertedStation, location)
        }
        await tick()

        // Verify we got it attached
        if (action.metadata?.convertedStation?.id !== this.station?.id) {
            return
        }

        gsap.set(this.element!, {
            opacity: 0
        })
        animate({
            object: this.element!,
            params: {
                opacity: 1
            },
            timeline,
            duration: 0.5,
            ease: 'power1.in',
            position: 0.4
        })
    }

    async animateFlyOrHurlAction(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.stationId) {
            return
        }

        const isStart = sameCoordinates(action.start, this.coords)
        const isDestination =
            sameCoordinates(action.destination, this.coords) &&
            !sameCoordinates(action.destination, CENTER_COORDS)
        if (!isStart && !isDestination) {
            return
        }

        if (isStart) {
            const board = fromState.board
            const startCell = board.cellAt(action.start)
            const startLocation = this.gameSession.locationForStationInCell(startCell)

            if (!startLocation) {
                return
            }

            timeline.set(this.element!, { opacity: 0 }, 0)
        }

        if (isDestination) {
            // console.log('Animating destination for station:', this.station?.id)
            const board = toState.board
            const destCell = board.cellAt(action.destination)
            const destLocation = this.gameSession.locationForStationInCell(destCell)

            if (!destLocation) {
                return
            }

            const station = toState.board.findStation(action.stationId)
            if (!station) {
                return
            }

            const flightPath = action.metadata?.flightPath
            if (!flightPath || flightPath.length < 2) {
                return
            }

            if (this.callback) {
                this.callback(station, destLocation)
            }
            await tick()

            const actualFlightPath = getFlightPath({
                action,
                gameSession: this.gameSession,
                playerId: action.playerId,
                pathCoords: flightPath,
                toState,
                fromState
            })
            const flightDuration = getFlightDuration(action, actualFlightPath.length)

            gsap.set(this.element!, {
                opacity: 0,
                x: offsetFromCenter(destLocation).x,
                y: offsetFromCenter(destLocation).y
            })

            // console.log('Animating arrival for station:', this.station?.id)
            // Appear right when they arrive
            timeline.set(this.element!, { opacity: 1 }, flightDuration)
        }
    }

    async animateMetamorphosize(
        action: Metamorphosize,
        animationContext: AnimationContext,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || this.station?.id !== action.stationId) {
            return
        }
        const station = fromState?.board.findStation(action.stationId)
        const newStation = action.metadata?.newStation
        if (!station || !newStation) {
            return
        }

        const hasClip = Boolean(this.clipRect)
        const hideDuration = hasClip ? 1 : 0
        const revealDuration = hasClip ? 1 : 0

        if (this.clipRect) {
            gsap.set(this.clipRect, { attr: { y: 0, height: 1 } })
            animate({
                object: this.clipRect,
                params: {
                    attr: {
                        y: 1,
                        height: 0
                    }
                },
                timeline: animationContext.actionTimeline,
                duration: hideDuration,
                ease: 'none',
                position: 0
            })
        }

        if (!newStation.coords) {
            return
        }
        const newCell = toState.board.cellAt(newStation.coords)

        call({
            callback: () => {
                if (this.callback) {
                    this.callback(newStation, this.gameSession.locationForStationInCell(newCell))
                }

                tick()
                    .then(() => {
                        const nextClipRect = this.clipRect
                        if (nextClipRect) {
                            gsap.set(nextClipRect, { attr: { y: 1, height: 0 } })
                            animate({
                                object: nextClipRect,
                                params: {
                                    attr: {
                                        y: 0,
                                        height: 1
                                    }
                                },
                                duration: revealDuration,
                                ease: 'power2.in'
                            })
                        }
                    })
                    .catch(() => {
                        // console.log('error')
                    })
            },
            timeline: animationContext.actionTimeline,
            position: hideDuration,
            duration: hasClip ? revealDuration : undefined
        })
    }
}

export function animateStation(
    node: HTMLElement | SVGElement,
    params: { animator: CellStationAnimator; station: Station; clipRect?: SVGRectElement }
):
    | {
          destroy: () => void
          update: (params: {
              animator: CellStationAnimator
              station: Station
              clipRect?: SVGRectElement
          }) => void
      }
    | undefined {
    params.animator.addStation(params.station, node, params.clipRect)
    return {
        update(nextParams) {
            params = nextParams
            params.animator.addStation(params.station, node, params.clipRect)
        },
        destroy() {
            params.animator.removeStation()
        }
    }
}
