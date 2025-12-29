import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    DrawCards,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isDrawCards,
    StationType,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { move, scale } from '$lib/utils/animations.js'
import { nanoid } from 'nanoid'
import { getMothershipSpotPoint, offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'

export class MomentumAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private pentagons: Map<string, HTMLElement | SVGElement> = new Map()

    addPentagon(id: string, element: HTMLElement | SVGElement): void {
        this.pentagons.set(id, element)
    }

    removePentagon(id: string): void {
        this.pentagons.delete(id)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action: GameAction
        animationContext: AnimationContext
    }) {
        if (isActivate(action) || isActivateBonus(action)) {
            await this.animateActivate(action, animationContext.actionTimeline, from)
        } else if (isActivateEffect(action)) {
            await this.animateActivateEffect(action, animationContext.actionTimeline, from)
        } else if (isDrawCards(action)) {
            await this.animateDrawCards(action, animationContext.actionTimeline, from)
        }
    }

    async animateActivate(
        action: Activate | ActivateBonus,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const numMomentum = action.metadata?.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationId = isActivate(action) ? action.stationId : action.metadata?.stationId
        if (!stationId) {
            return
        }

        const station = fromState.board.findStation(stationId)
        if (!station || station.type !== StationType.TransmitTower || !station.coords) {
            return
        }

        const stationCell = fromState.board.cellAt(station.coords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    async animateActivateEffect(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numMomentum = action.metadata.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const station = stationCell.station
        if (!station || station.type !== StationType.TransmitTower) {
            return
        }

        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numMomentum = action.metadata.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const station = stationCell.station
        if (!station || station.type !== StationType.TransmitTower) {
            return
        }

        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    private async animateMomentumFromLocation(
        playerId: string,
        numMomentum: number,
        startLocation: Point,
        timeline: gsap.core.Timeline,
        fromState: HydratedSolGameState
    ) {
        this.gameSession.movingMomentumIds = range(0, numMomentum).map(() => nanoid())
        await tick()

        const delayBetween = 0.2
        const moveDuration = 1
        const scaleDuration = 0.1
        const moveOffset = scaleDuration / 2
        const startTime = 0

        const pentagonElements = Array.from(this.pentagons.values())
        for (const pentagon of pentagonElements) {
            gsap.set(pentagon, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%'
            })
        }

        const mothershipLocation = this.getMothershipLocationForPlayer(fromState, playerId)
        let i = 0
        for (const pentagon of pentagonElements) {
            const position = startTime + delayBetween * i
            timeline.set(
                pentagon,
                {
                    opacity: 1,
                    x: offsetFromCenter(startLocation).x,
                    y: offsetFromCenter(startLocation).y
                },
                position
            )

            scale({
                object: pentagon,
                to: 1,
                duration: scaleDuration,
                ease: 'power2.in',
                timeline,
                position
            })

            move({
                object: pentagon,
                location: offsetFromCenter(mothershipLocation),
                timeline,
                duration: moveDuration,
                position: position + moveOffset
            })
            i++
        }

        const lastStart = startTime + delayBetween * (numMomentum - 1) + moveOffset
        timeline.call(
            () => {
                this.gameSession.movingMomentumIds = []
            },
            [],
            lastStart + moveDuration
        )
    }

    getMothershipLocationForPlayer(gameState: HydratedSolGameState, playerId: string): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        const spotPoint = getMothershipSpotPoint(gameState.players.length, mothershipIndex)

        return {
            x: spotPoint.x,
            y: spotPoint.y
        }
    }
}

export function animateMomentum(
    node: HTMLElement | SVGElement,
    params: { animator: MomentumAnimator; momentumId: string }
): { destroy: () => void } {
    params.animator.addPentagon(params.momentumId, node)
    return {
        destroy() {
            params.animator.removePentagon(params.momentumId)
        }
    }
}
