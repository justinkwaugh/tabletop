import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    Chain,
    DrawCards,
    Fly,
    HydratedSolGameState,
    isSolarFlare,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isChain,
    isDrawCards,
    isFly,
    isHurl,
    StationType,
    SolarFlare,
    Hurl,
    CENTER_COORDS,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { move, scale } from '$lib/utils/animations.js'
import { nanoid } from 'nanoid'
import {
    getCirclePoint,
    getDeckCenterPoint,
    getGatePosition,
    getMothershipSpotPoint,
    getSpaceCentroid,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    getFlyOrHurlArrivalTime,
    getFlyOrHurlEndLocation,
    getGateCrossingTimes,
    CHAIN_MOMENTUM_MOVE_DURATION,
    CHAIN_MOMENTUM_STAGGER
} from '$lib/utils/animationsUtils.js'

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
        } else if (isChain(action)) {
            await this.animateChain(action, animationContext.actionTimeline, from)
        } else if (isFly(action) || isHurl(action)) {
            await this.animateFlyOrHurl(action, animationContext.actionTimeline, to, from)
        } else if (isSolarFlare(action)) {
            await this.animateSolarFlare(action, animationContext.actionTimeline, from)
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
        if (!fromState) {
            return
        }

        const numMomentum = action.metadata?.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const deckLocation = getDeckCenterPoint()
        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            deckLocation,
            timeline,
            fromState
        )
    }

    async animateChain(
        action: Chain,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || action.chain.length === 0) {
            return
        }

        type MomentumMove = { from: Point; to: Point; startTime: number }
        const momentumMoves: MomentumMove[] = []

        const delayBetween = CHAIN_MOMENTUM_STAGGER
        for (const entry of action.chain) {
            const cell = fromState.board.cellAt(entry.coords)
            const sundiver = cell.sundivers.find((diver) => diver.id === entry.sundiverId)
            if (!sundiver) {
                continue
            }
            const startLocation =
                this.gameSession.locationForDiverInCell(sundiver.playerId, cell) ??
                getSpaceCentroid(this.gameSession.numPlayers, entry.coords)
            const mothershipLocation = this.getMothershipLocationForPlayer(
                fromState,
                sundiver.playerId
            )

            momentumMoves.push({
                from: startLocation,
                to: mothershipLocation,
                startTime: delayBetween * momentumMoves.length
            })
        }

        if (momentumMoves.length === 0) {
            return
        }

        this.gameSession.movingMomentumIds = range(0, momentumMoves.length).map(() => nanoid())
        await tick()

        const moveDuration = CHAIN_MOMENTUM_MOVE_DURATION
        const scaleDuration = 0.1
        const moveOffset = scaleDuration / 2

        const pentagonElements = Array.from(this.pentagons.values())
        for (const pentagon of pentagonElements) {
            gsap.set(pentagon, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%'
            })
        }

        let maxEndTime = 0
        for (let i = 0; i < momentumMoves.length; i++) {
            const pentagon = pentagonElements[i]
            if (!pentagon) {
                continue
            }

            const moveTarget = momentumMoves[i]
            const position = moveTarget.startTime

            timeline.set(
                pentagon,
                {
                    opacity: 1,
                    x: offsetFromCenter(moveTarget.from).x,
                    y: offsetFromCenter(moveTarget.from).y
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
                location: offsetFromCenter(moveTarget.to),
                timeline,
                duration: moveDuration,
                position: position + moveOffset
            })

            const endTime = position + moveOffset + moveDuration
            if (endTime > maxEndTime) {
                maxEndTime = endTime
            }
        }

        timeline.call(
            () => {
                this.gameSession.movingMomentumIds = []
            },
            [],
            maxEndTime
        )
    }

    async animateSolarFlare(
        action: SolarFlare,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const hurlBonusPlayerId = action.metadata?.hurlBonus
        if (!hurlBonusPlayerId) {
            return
        }

        const startLocation = getSpaceCentroid(this.gameSession.numPlayers, CENTER_COORDS)
        await this.animateMomentumFromLocation(
            hurlBonusPlayerId,
            1,
            startLocation,
            timeline,
            fromState
        )
    }

    async animateFlyOrHurl(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const totalMomentum = action.metadata?.momentumGained ?? 0
        const passageCount = action.metadata?.passage
            ? Math.min(action.gates.length, totalMomentum)
            : 0
        const remainingMomentum = Math.max(0, totalMomentum - passageCount)

        if (passageCount === 0 && remainingMomentum === 0) {
            return
        }

        type MomentumMove = { from: Point; startTime: number }
        const momentumMoves: MomentumMove[] = []

        if (passageCount > 0) {
            const gateLocations = new Map<number, Point>()
            for (const gate of action.gates) {
                if (!gate.innerCoords || !gate.outerCoords) {
                    continue
                }
                const gateKey = fromState.board.gateKey(gate.innerCoords, gate.outerCoords)
                if (!gateLocations.has(gateKey)) {
                    const gatePosition = getGatePosition(
                        this.gameSession.numPlayers,
                        gate.innerCoords,
                        gate.outerCoords
                    )
                    gateLocations.set(
                        gateKey,
                        getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
                    )
                }
            }

            const gateCrossingTimes = getGateCrossingTimes({
                action,
                toState,
                fromState,
                gateLocations,
                gameSession: this.gameSession
            })

            let remainingPassage = passageCount
            for (const gate of action.gates) {
                if (remainingPassage <= 0) {
                    break
                }
                if (!gate.innerCoords || !gate.outerCoords) {
                    continue
                }
                const gateKey = fromState.board.gateKey(gate.innerCoords, gate.outerCoords)
                const gateLocation = gateLocations.get(gateKey)
                if (!gateLocation) {
                    continue
                }
                const startTime = gateCrossingTimes.get(gateKey) ?? 0
                momentumMoves.push({ from: gateLocation, startTime })
                remainingPassage -= 1
            }
        }

        if (remainingMomentum > 0) {
            const startLocation = getFlyOrHurlEndLocation({
                action,
                toState,
                gameSession: this.gameSession
            })
            const startTime = getFlyOrHurlArrivalTime({
                action,
                toState,
                fromState,
                gameSession: this.gameSession
            })
            const delayBetween = 0.2
            for (let i = 0; i < remainingMomentum; i++) {
                momentumMoves.push({
                    from: startLocation,
                    startTime: startTime + delayBetween * i
                })
            }
        }

        if (momentumMoves.length === 0) {
            return
        }

        this.gameSession.movingMomentumIds = range(0, momentumMoves.length).map(() => nanoid())
        await tick()

        const moveDuration = 1
        const scaleDuration = 0.1
        const moveOffset = scaleDuration / 2

        const pentagonElements = Array.from(this.pentagons.values())
        for (const pentagon of pentagonElements) {
            gsap.set(pentagon, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%'
            })
        }

        const mothershipLocation = this.getMothershipLocationForPlayer(fromState, action.playerId)
        let maxEndTime = 0
        for (let i = 0; i < momentumMoves.length; i++) {
            const pentagon = pentagonElements[i]
            if (!pentagon) {
                continue
            }
            const moveTarget = momentumMoves[i]
            const position = moveTarget.startTime

            timeline.set(
                pentagon,
                {
                    opacity: 1,
                    x: offsetFromCenter(moveTarget.from).x,
                    y: offsetFromCenter(moveTarget.from).y
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

            const endTime = position + moveOffset + moveDuration
            if (endTime > maxEndTime) {
                maxEndTime = endTime
            }
        }

        timeline.call(
            () => {
                this.gameSession.movingMomentumIds = []
            },
            [],
            maxEndTime
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
