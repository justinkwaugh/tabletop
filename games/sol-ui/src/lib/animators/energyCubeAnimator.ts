import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    EffectType,
    Fly,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isFly,
    isHurl,
    isTribute,
    Hurl,
    Tribute,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { ensureDuration, fadeIn, fadeOut, move, scale } from '$lib/utils/animations.js'
import { nanoid } from 'nanoid'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'

export class EnergyCubeAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private cubes: Map<string, HTMLElement | SVGElement> = new Map()

    addCube(id: string, element: HTMLElement | SVGElement): void {
        this.cubes.set(id, element)
    }

    removeCube(id: string): void {
        this.cubes.delete(id)
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
            await this.animateActivate(action, animationContext.actionTimeline, to, from)
        } else if (isTribute(action)) {
            await this.animateTribute(action, animationContext.actionTimeline, from)
        } else if (isFly(action) || isHurl(action)) {
            await this.animateGatePayments(action, animationContext.actionTimeline, from)
        }
    }

    async animateActivate(
        action: Activate | ActivateBonus,
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
        const moveDuration = 1
        const startTime = 0

        // Set the initial location of the cubes at the energy node
        const stationId = isActivate(action) ? action.stationId : action.metadata?.stationId
        if (!stationId) {
            return
        }
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

    async animateTribute(
        tribute: Tribute,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !tribute.metadata) {
            return
        }

        const numCubes = Object.values(tribute.metadata.payments).reduce((a, b) => a + b, 0)
        this.gameSession.movingCubeIds = range(0, numCubes).map(() => nanoid())

        await tick()

        const toLocation = this.getMothershipLocationForPlayer(fromState, tribute.playerId)

        const delayBetween = 0.2
        const moveDuration = 1

        const cubesCopy = Array.from(this.cubes.values())
        let maxDuration = 0
        for (const [fromPlayerId, count] of Object.entries(tribute.metadata.payments)) {
            const startTime = 0

            const fromLocation = this.getMothershipLocationForPlayer(fromState, fromPlayerId)
            const cubeElements = cubesCopy.splice(0, count)

            for (const cube of cubeElements) {
                gsap.set(cube, {
                    x: offsetFromCenter(fromLocation).x,
                    y: offsetFromCenter(fromLocation).y
                })
            }

            let i = 0
            for (const cube of cubeElements) {
                move({
                    object: cube,
                    location: offsetFromCenter(toLocation),
                    timeline,
                    duration: moveDuration,
                    position: startTime + delayBetween * i
                })
                i++
            }

            const duration = moveDuration + delayBetween * (count - 1)
            if (duration > maxDuration) {
                maxDuration = duration
            }
        }

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            maxDuration
        )
    }

    async animateGatePayments(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const paidPlayerIds = action.metadata?.paidPlayerIds ?? []
        if (paidPlayerIds.length === 0 || action.gates.length === 0) {
            return
        }

        const gateByPlayerId = new Map<string, (typeof action.gates)[number]>()
        for (const gate of action.gates) {
            if (!gateByPlayerId.has(gate.playerId)) {
                gateByPlayerId.set(gate.playerId, gate)
            }
        }

        const cubeMoves: { from: Point; to: Point }[] = []
        for (const playerId of paidPlayerIds) {
            const gate = gateByPlayerId.get(playerId)
            if (!gate?.innerCoords || !gate?.outerCoords) {
                continue
            }

            const gatePosition = getGatePosition(
                this.gameSession.numPlayers,
                gate.innerCoords,
                gate.outerCoords
            )
            const gateLocation = getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
            const mothershipLocation = this.getMothershipLocationForPlayer(fromState, playerId)

            cubeMoves.push({ from: gateLocation, to: mothershipLocation })
        }

        if (cubeMoves.length === 0) {
            return
        }

        this.gameSession.movingCubeIds = range(0, cubeMoves.length).map(() => nanoid())
        await tick()

        const delayBetween = 0.2
        const moveDuration = 1
        const startTime = 0

        const cubeElements = Array.from(this.cubes.values())

        for (let i = 0; i < cubeMoves.length; i++) {
            const cube = cubeElements[i]
            if (!cube) {
                continue
            }
            const moveTarget = cubeMoves[i]

            gsap.set(cube, {
                x: offsetFromCenter(moveTarget.from).x,
                y: offsetFromCenter(moveTarget.from).y
            })

            move({
                object: cube,
                location: offsetFromCenter(moveTarget.to),
                timeline,
                duration: moveDuration,
                position: startTime + delayBetween * i
            })
        }

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            startTime + moveDuration + delayBetween * (cubeMoves.length - 1)
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
