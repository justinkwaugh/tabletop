import {
    Convert,
    gateKey,
    HydratedSolGameState,
    isConvert,
    SolarGate,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { Point, sameCoordinates, type GameAction, type OffsetCoordinates } from '@tabletop/common'
import { animate, ensureDuration, fadeIn, fadeOut, scale } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import { getGatePosition } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'

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
        }

        // const toBoard = to.board
        // const fromBoard = from?.board
        // const toCell = toBoard.cellAt(this.coords)
        // const fromCell = fromBoard?.cellAt(this.coords)
        // const toStation = toCell.station
        // const fromStation = fromCell?.station
        // if (fromStation && !toStation) {
        //     fadeOut({
        //         object: this.element!,
        //         timeline,
        //         duration: 0.3
        //     })
        // }
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
        animate({
            object: gateAndElement.element,
            params: {
                opacity: 1
            },
            timeline,
            duration: 0.5,
            ease: 'power1.in',
            position: 0.4
        })
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
