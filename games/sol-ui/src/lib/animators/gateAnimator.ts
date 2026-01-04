import {
    Convert,
    gateKey,
    HydratedSolGameState,
    isFly,
    isConvert,
    Fly,
    SolarGate,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { type GameAction } from '@tabletop/common'
import { animate, fadeIn, fadeOut } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import { getGatePosition } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration } from '$lib/utils/flight.js'

type GateAndElement = {
    gate: SolarGate
    element: HTMLElement | SVGElement
}

export class GateAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private gatesById = new Map<string, GateAndElement>()
    private gatesByKey = new Map<number, GateAndElement>()

    constructor(
        gameSession: SolGameSession,
        private callback?: (gate?: SolarGate) => void
    ) {
        super(gameSession)
    }

    addGate(gate: SolarGate, element: HTMLElement | SVGElement): void {
        const gateAndElement: GateAndElement = { gate, element }
        this.gatesById.set(gate.id, gateAndElement)
        this.gatesByKey.set(gateKey(gate.innerCoords!, gate.outerCoords!), gateAndElement)
    }

    removeGate(id: string): void {
        const gateAndElement = this.gatesById.get(id)
        if (gateAndElement) {
            this.gatesById.delete(id)
            this.gatesByKey.delete(
                gateKey(gateAndElement.gate.innerCoords!, gateAndElement.gate.outerCoords!)
            )
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
        if (isConvert(action)) {
            await this.animateConvert(action, animationContext.actionTimeline, to, from)
            return
        }

        if (!from) {
            return
        }

        const toGates = to.board.gates
        const fromGates = from.board.gates
        const appearTime = 0.3
        const addedGates: SolarGate[] = []
        const removedGates: SolarGate[] = []
        const puncturedGateId = isFly(action) ? action.metadata?.puncturedGate?.id : undefined
        let punctureFadeStart: number | undefined

        for (const [key, gate] of Object.entries(toGates)) {
            if (!fromGates[Number(key)]) {
                addedGates.push(gate)
            }
        }

        for (const [key, gate] of Object.entries(fromGates)) {
            if (!toGates[Number(key)]) {
                removedGates.push(gate)
            }
        }

        if (puncturedGateId) {
            const delayBetween = 0.3
            const jitterDuration = 1
            const burstDuration = 0.25
            const fadeOutDuration = 0.1
            const approachDuration = getFlightDuration(action as Fly, 2)
            const lastIndex = Math.max(0, (action as Fly).sundiverIds.length - 1)
            punctureFadeStart =
                lastIndex * delayBetween +
                approachDuration +
                jitterDuration +
                burstDuration +
                fadeOutDuration
        }

        if (addedGates.length > 0 && this.callback) {
            for (const gate of addedGates) {
                this.callback(gate)
            }
            await tick()
        }

        const timeline = animationContext.actionTimeline
        for (const gate of addedGates) {
            const gateAndElement =
                this.gatesById.get(gate.id) ??
                this.gatesByKey.get(gateKey(gate.innerCoords!, gate.outerCoords!))
            if (!gateAndElement) {
                continue
            }
            gsap.set(gateAndElement.element, { opacity: 0 })
            if (punctureFadeStart !== undefined && gate.id === puncturedGateId) {
                fadeIn({
                    object: gateAndElement.element,
                    timeline,
                    duration: 0.3,
                    position: punctureFadeStart
                })
            } else {
                timeline.set(gateAndElement.element, { opacity: 1 }, appearTime)
            }
        }

        for (const gate of removedGates) {
            const gateAndElement =
                this.gatesById.get(gate.id) ??
                this.gatesByKey.get(gateKey(gate.innerCoords!, gate.outerCoords!))
            if (!gateAndElement) {
                continue
            }
            fadeOut({
                object: gateAndElement.element,
                timeline,
                duration: 0
            })
        }
    }

    async animateConvert(
        action: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.isGate || !action.metadata?.convertedGate) {
            return
        }

        if (!action.innerCoords) {
            return
        }

        const gatePosition = getGatePosition(
            this.gameSession.numPlayers,
            action.innerCoords,
            action.coords
        )

        // Trigger rendering/attachment of the converted station
        if (this.callback) {
            this.callback(action.metadata.convertedGate)
        }

        await tick()

        // Verify we got it attached
        const gateAndElement = this.gatesById.get(action.metadata.convertedGate.id)
        if (!gateAndElement) {
            return
        }

        gsap.set(gateAndElement.element, {
            opacity: 0
        })
        const revealStart = 0.4
        const revealDuration = 0.5
        animate({
            object: gateAndElement.element,
            params: {
                opacity: 1
            },
            timeline,
            duration: revealDuration,
            ease: 'power1.in',
            position: revealStart
        })

        const fromCount = fromState.getPlayerState(action.playerId).solarGates.length
        const nextCount = Math.max(0, fromCount - 1)
        this.scheduleSolarGateOverrideAt(
            action.playerId,
            nextCount,
            timeline,
            revealStart + revealDuration
        )
    }

    private scheduleSolarGateOverrideAt(
        playerId: string,
        solarGates: number,
        timeline: gsap.core.Timeline,
        time: number
    ) {
        timeline.call(
            () => {
                const existing = this.gameSession.playerStateOverrides.get(playerId) ?? {}
                this.gameSession.playerStateOverrides.set(playerId, {
                    ...existing,
                    solarGates
                })
            },
            [],
            time
        )
    }
}

export function animateGate(
    node: HTMLElement | SVGElement,
    params: { animator: GateAnimator; gate: SolarGate }
): { destroy: () => void } | undefined {
    params.animator.addGate(params.gate, node)
    return {
        destroy() {
            params.animator.removeGate(params.gate.id)
        }
    }
}
