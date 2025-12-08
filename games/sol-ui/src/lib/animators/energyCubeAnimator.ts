import {
    Activate,
    ActivateBonus,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { ensureDuration, fadeIn, fadeOut, move, scale } from '$lib/utils/animations.js'
import { Flip } from 'gsap/dist/Flip'
import { nanoid } from 'nanoid'
import { getMothershipSpotPoint, offsetFromCenter } from '$lib/utils/boardGeometry.js'

export class EnergyCubeAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private cubes: Map<string, HTMLElement | SVGElement> = new Map()

    addCube(id: string, element: HTMLElement | SVGElement): void {
        console.log('add cube to animator:', id)
        this.cubes.set(id, element)
    }

    removeCube(id: string): void {
        this.cubes.delete(id)
        console.log('remove cube from animator:', id)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action: GameAction
        timeline: gsap.core.Timeline
    }) {
        if (isActivate(action)) {
            this.animateActivate(action, timeline, to, from)
        }
    }

    async animateActivate(
        action: Activate,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const numCubes = action.metadata?.energyAdded ?? 0

        if (numCubes <= 0) {
            return
        }

        this.gameSession.movingCubeIds = range(0, numCubes).map(() => nanoid())
        await tick()

        const delayBetween = 0.2
        const moveDuration = 0.5
        const startTime = 0

        // Set the initial location of the cubes at the energy node
        const stationId = action.stationId
        const stationCoords = fromState.board.findStation(stationId)?.coords
        if (!stationCoords) {
            return
        }
        const stationCell = fromState?.board.cellAt(stationCoords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)

        if (!stationLocation) {
            return
        }

        const cubeElements = Array.from(this.cubes.values())

        for (const cube of cubeElements) {
            gsap.set(cube, {
                x: offsetFromCenter(stationLocation).x,
                y: offsetFromCenter(stationLocation).y
            })
        }

        // Get the final location of the cubes at the mothership
        const mothershipLocation = this.getMothershipLocationForPlayer(fromState, action.playerId)

        let i = 0
        for (const cube of cubeElements) {
            move({
                object: cube,
                location: offsetFromCenter(mothershipLocation),
                timeline,
                duration: moveDuration,
                position: startTime + delayBetween * i
            })
            i++
        }

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            startTime + moveDuration + delayBetween * (numCubes - 1)
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

export function animateCube(
    node: HTMLElement | SVGElement,
    params: { animator: EnergyCubeAnimator; cubeId: string }
): { destroy: () => void } {
    params.animator.addCube(params.cubeId, node)
    return {
        destroy() {
            params.animator.removeCube(params.cubeId)
        }
    }
}
