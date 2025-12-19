import {
    Activate,
    ActivateBonus,
    Convert,
    DrawCards,
    EnergyNode,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isConvert,
    isDrawCards,
    isSolarFlare,
    MachineState,
    SolarFlare,
    Station,
    StationType,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { Point, sameCoordinates, type GameAction, type OffsetCoordinates } from '@tabletop/common'
import { animate, ensureDuration, fadeIn, fadeOut, scale } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'

export class CellStationAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private station?: Station

    constructor(
        gameSession: SolGameSession,
        private coords: OffsetCoordinates,
        private callback?: (station?: Station, location?: Point) => void
    ) {
        super(gameSession)
    }

    addStation(station: Station, element: HTMLElement | SVGElement): void {
        this.station = station
        this.setElement(element)
    }

    removeStation(): void {
        delete this.station
        this.setElement(undefined)
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
}

export function animateStation(
    node: HTMLElement | SVGElement,
    params: { animator: CellStationAnimator; station: Station }
): { destroy: () => void } | undefined {
    params.animator.addStation(params.station, node)
    return {
        destroy() {
            params.animator.removeStation()
        }
    }
}
