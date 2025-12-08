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
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { Point, sameCoordinates, type GameAction, type OffsetCoordinates } from '@tabletop/common'
import { animate, ensureDuration, fadeIn, scale } from '$lib/utils/animations.js'
import { tick } from 'svelte'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'

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
        console.log('CellStationAnimator addStation:', station.id, station.type)
        this.station = station
        this.setElement(element)
    }

    removeStation(): void {
        console.log('CellStationAnimator removeStation:', this.station?.id, this.station?.type)
        delete this.station
        this.setElement(undefined)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        timeline: gsap.core.Timeline
    }) {
        if (isActivate(action) || isActivateBonus(action)) {
            this.animateActivate(action, timeline, to, from)
        } else if (isConvert(action)) {
            await this.animateConvert(action, timeline, to, from)
        }
    }

    animateActivate(
        action: Activate | ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        this.gameSession.forcedCallToAction = `${action.metadata?.energyAdded ?? 0} ENERGY ADDED`
        ensureDuration(timeline, 1.5)
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
