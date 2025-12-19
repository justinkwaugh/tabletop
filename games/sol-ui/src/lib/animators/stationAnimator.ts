import {
    CENTER_COORDS,
    Fly,
    Hurl,
    HydratedSolGameState,
    isFly,
    isHurl,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, sameCoordinates } from '@tabletop/common'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, path } from '$lib/utils/animations.js'
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
        }
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
            ease: fly.teleport ? 'power2.inOut' : 'power1.inOut',
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
