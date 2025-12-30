import {
    CENTER_COORDS,
    Fly,
    Hurl,
    HydratedSolGameState,
    isFly,
    isHurl,
    type Station,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, sameCoordinates, samePoint, type Point } from '@tabletop/common'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, move, path } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPath } from '$lib/utils/flight.js'

import { tick } from 'svelte'

export class StationAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(gameSession: SolGameSession) {
        super(gameSession)
    }

    override onAttach(): void {
        if (this.element) {
            gsap.set(this.element, { opacity: 0 })
        }
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
        if (action) {
            await this.animateAction(action, animationContext.actionTimeline, to, from)
            return
        }

        if (!from) {
            return
        }

        const fromLocations = new Map<string, { station: Station; location: Point }>()
        for (const cell of from.board) {
            if (!cell.station) {
                continue
            }
            const location = this.gameSession.locationForStationInCell(cell)
            if (!location) {
                continue
            }
            fromLocations.set(cell.station.id, { station: cell.station, location })
        }

        let movedStation: Station | undefined
        let fromLocation: Point | undefined
        let toLocation: Point | undefined
        for (const cell of to.board) {
            if (!cell.station) {
                continue
            }
            const fromEntry = fromLocations.get(cell.station.id)
            if (!fromEntry) {
                continue
            }
            const location = this.gameSession.locationForStationInCell(cell)
            if (!location || samePoint(location, fromEntry.location)) {
                continue
            }
            movedStation = cell.station
            fromLocation = fromEntry.location
            toLocation = location
            break
        }

        if (!movedStation || !fromLocation || !toLocation) {
            return
        }

        this.gameSession.movingStation = movedStation
        await tick()

        if (!this.element) {
            return
        }

        gsap.set(this.element, {
            opacity: 1,
            x: offsetFromCenter(fromLocation).x,
            y: offsetFromCenter(fromLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(toLocation),
            duration: 0.3,
            ease: 'power1.inOut',
            timeline: animationContext.actionTimeline,
            position: 0
        })

        fadeOut({
            object: this.element,
            duration: 0.1,
            timeline: animationContext.actionTimeline,
            position: '>'
        })
    }

    async animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isFly(action) || isHurl(action)) {
            await this.animateFlyOrHurlAction(action, timeline, toState, fromState)
        }
    }

    async animateFlyOrHurlAction(
        fly: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !fly.stationId) {
            return
        }

        const station = fromState.board.findStation(fly.stationId)
        if (!station) {
            return
        }

        const flightPath = structuredClone(fly.metadata?.flightPath)
        if (!flightPath || flightPath.length < 2) {
            return
        }

        const locations = getFlightPath({
            action: fly,
            gameSession: this.gameSession,
            playerId: fly.playerId,
            pathCoords: flightPath,
            toState,
            fromState
        })

        if (locations.length === 0) {
            return
        }

        this.gameSession.movingStation = station
        await tick()

        const flightDuration = getFlightDuration(fly, locations.length)
        const startLocation = locations.shift()

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        const flightStart = 0

        timeline.add(
            gsap.to(this.element!, {
                xPercent: 3,
                yPercent: 3,
                duration: flightDuration,
                ease: 'wiggle({type:random, wiggles:500})'
            }),
            0
        )

        path({
            object: this.element,
            path: locations.map((loc) => offsetFromCenter(loc)),
            curviness: 1,
            duration: flightDuration,
            ease: fly.teleport ? 'power2.inOut' : 'power2.inOut',
            timeline,
            position: flightStart
        })

        if (sameCoordinates(flightPath.at(-1), CENTER_COORDS)) {
            // Special case for center space - just fade out
            fadeOut({
                object: this.element!,
                duration: 0.3,
                timeline,
                position: '>'
            })
        } else {
            fadeOut({
                object: this.element!,
                duration: 0,
                timeline,
                position: '>'
            })
        }
    }
}

export function animateStation(
    node: HTMLElement | SVGElement,
    params: { animator: StationAnimator }
): { destroy: () => void } {
    params.animator.setElement(node)
    return {
        destroy() {
            params.animator.setElement(undefined)
        }
    }
}
