import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    CENTER_COORDS,
    Convert,
    DrawCards,
    EffectType,
    Hatch,
    Fly,
    Hurl,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isConvert,
    isDrawCards,
    isHatch,
    isFly,
    isHurl,
    isLaunch,
    Launch,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, OffsetCoordinates, sameCoordinates, type Point } from '@tabletop/common'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, move, scale, path, fadeIn } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPath } from '$lib/utils/flight.js'

type SetQuantityCallback = (quantity: number) => void

export class SundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private quantityCallback?: SetQuantityCallback
    constructor(
        gameSession: SolGameSession,
        private id: string
    ) {
        super(gameSession)
    }

    setQuantityCallback(callback: SetQuantityCallback): void {
        this.quantityCallback = callback
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
        if (!this.element) {
            return
        }

        if (action) {
            this.animateAction(action, animationContext.actionTimeline, to, from)
            return
        }

        // const toSundiver: Sundiver | undefined = Iterator.from(to.getAllSundivers()).find(
        //     (d) => d.id === this.id
        // )
        // const fromSundiver: Sundiver | undefined = Iterator.from(
        //     from?.getAllSundivers() ?? []
        // ).find((d) => d.id === this.id)
        // let fromLocation: Point | undefined
        // let toLocation: Point | undefined
        // let hide = false

        // // Figure out where we are going
        // if (toSundiver) {
        //     // In a cell
        //     if (toSundiver.coords) {
        //         if (sameCoordinates(fromSundiver?.coords, toSundiver.coords)) {
        //             return
        //         }
        //         const cell = to.board.cellAt(toSundiver.coords)
        //         if (cell) {
        //             toLocation = this.gameSession.locationForDiverInCell(toSundiver.playerId, cell)
        //         }
        //         // In a hold
        //     } else if (toSundiver.hold) {
        //         if (fromSundiver?.hold === toSundiver.hold) {
        //             return
        //         }
        //         toLocation = this.getMothershipLocationForPlayer(to, toSundiver.hold)
        //         hide = true
        //     } else if (toSundiver.reserve) {
        //         // We need some idea of what happened.  We may need to do something like
        //         // move to the converted station and disappear
        //         if (!fromSundiver?.coords) {
        //             return
        //         }
        //         hide = true
        //     }
        // }

        // if (fromSundiver) {
        //     if (fromSundiver.coords) {
        //         const fromCell = from?.board.cellAt(fromSundiver.coords)
        //         if (fromCell) {
        //             fromLocation = this.gameSession.locationForDiverInCell(
        //                 fromSundiver.playerId,
        //                 fromCell
        //             )
        //         }
        //     } else if (fromSundiver.hold) {
        //         gsap.set(this.element, { opacity: 1 })
        //         fromLocation = this.getMothershipLocationForPlayer(from!, fromSundiver.hold)
        //     }
        // }

        // if (fromLocation) {
        //     const changes = Object.assign({}, offsetFromCenter(fromLocation), {
        //         opacity: 1
        //     })
        //     gsap.set(this.element, changes)
        // }

        // if (toLocation) {
        //     move({
        //         object: this.element,
        //         location: offsetFromCenter(toLocation),
        //         duration: 0.5,
        //         timeline,
        //         position: 'movingPieces'
        //     })
        // }
        // if (hide) {
        //     timeline.to(this.element, {
        //         opacity: 0,
        //         duration: 0,
        //         position: '>'
        //     })
        // }
    }

    animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isConvert(action)) {
            this.animateConvertAction(action, timeline, toState, fromState)
        } else if (isActivate(action)) {
            this.animateActivateAction(action, timeline, toState, fromState)
        } else if (isActivateBonus(action)) {
            this.animateActivateBonusAction(action, timeline, toState, fromState)
        } else if (isLaunch(action)) {
            this.animateLaunchAction(action, timeline, toState, fromState)
        } else if (isFly(action) || isHurl(action)) {
            this.animateFlyOrHurlAction(action, timeline, toState, fromState)
        } else if (isActivateEffect(action)) {
            this.animateActivateEffectAction(action, timeline, toState, fromState)
        } else if (isDrawCards(action)) {
            this.animateDrawCardsAction(action, timeline, toState, fromState)
        } else if (isHatch(action)) {
            this.animateHatchAction(action, timeline, toState, fromState)
        }
    }

    animateLaunchAction(
        launch: Launch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        const launchIndex = launch.metadata?.sundiverIds.indexOf(this.id)
        if (launchIndex === undefined || launchIndex < 0) {
            return
        }
        const board = toState.board

        // Determine which mothership, because portal can make it any
        const mothership = toState.findAdjacentMothership(launch.destination) ?? launch.mothership
        const diverLocation = this.getMothershipLocationForPlayer(fromState ?? toState, mothership)

        const targetCell = board.cellAt(launch.destination)
        const targetLocation = this.gameSession.locationForDiverInCell(launch.playerId, targetCell)

        if (!diverLocation || !targetLocation) {
            return
        }

        const moveDuration = 0.5
        const delayBetween = 0.3

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: this.element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: launchIndex * 0.2
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: moveDuration,
            ease: 'power2.out',
            timeline,
            position: launchIndex * delayBetween
        })
        fadeOut({
            object: this.element,
            duration: 0,
            timeline,
            position: '>'
        })
    }

    animateFlyOrHurlAction(
        fly: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }
        const index = fly.sundiverIds.indexOf(this.id)
        if (index === -1) {
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

        const flightDuration = getFlightDuration(fly, locations.length)
        const startLocation = locations.shift()

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        const delayBetween = 0.3
        const flightStart = index * delayBetween

        if (fly.teleport) {
            fadeOut({
                object: this.element,
                duration: 0.3,
                timeline,
                position: flightStart + 0.2
            })
            fadeIn({
                object: this.element,
                duration: 0.3,
                timeline,
                position: flightStart + flightDuration - 0.5
            })
        }

        path({
            object: this.element,
            path: locations.map((loc) => offsetFromCenter(loc)),
            curviness: 1,
            duration: flightDuration,
            ease: fly.teleport ? 'power2.inOut' : 'power1.inOut',
            timeline,
            position: index * delayBetween
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

    animateHatchAction(
        action: Hatch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.replacedSundiver) {
            return
        }

        if (action.metadata.replacedSundiver.id !== this.id) {
            return
        }

        const startCell = fromState.board.cellAt(action.coords)
        const startLocation = startCell
            ? this.gameSession.locationForDiverInCell(action.targetPlayerId, startCell)
            : undefined
        const targetLocation = this.getMothershipLocationForPlayer(
            fromState ?? toState,
            action.targetPlayerId
        )

        if (!startLocation || !targetLocation) {
            return
        }

        const leaveStart = 0.5

        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: leaveStart
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateConvertAction(
        convert: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!convert.sundiverIds.includes(this.id)) {
            return
        }

        const toBoard = toState.board
        const fromBoard = fromState?.board

        if (!fromBoard) {
            return
        }

        const diverCoords = fromBoard.findSundiverCoords(this.id)
        const diverCell = fromBoard.cellAt(diverCoords!)
        const diverLocation = this.gameSession.locationForDiverInCell(convert.playerId, diverCell)

        let targetLocation: Point | undefined
        if (!convert.isGate) {
            const stationCell = toBoard.cellAt(convert.coords)
            targetLocation = this.gameSession.locationForStationInCell(stationCell)
        } else if (convert.innerCoords && convert.coords) {
            const gatePosition = getGatePosition(
                this.gameSession.numPlayers,
                convert.innerCoords,
                convert.coords
            )
            targetLocation = getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
        }
        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: 0
        })

        if (fromState.activeEffect === EffectType.Cascade) {
            const targetLocation = this.getMothershipLocationForPlayer(
                fromState ?? toState,
                convert.playerId
            )

            const index = convert.sundiverIds.indexOf(this.id)
            if (targetLocation) {
                move({
                    object: this.element,
                    location: offsetFromCenter(targetLocation),
                    duration: 0.5,
                    ease: 'power2.in',
                    timeline,
                    position: '>' + (index > 0 ? '+' + index * 0.2 : '')
                })
                return
            }
        }

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateAction(
        activate: Activate,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !activate.metadata) {
            return
        }

        const isActivatingSundiver = activate.metadata.sundiverId === this.id
        if (!isActivatingSundiver) {
            this.animateCreatedSundivers(
                activate.metadata.createdSundiverIds,
                activate.coords,
                activate.playerId,
                timeline,
                toState,
                fromState
            )
            return
        }

        const fromBoard = fromState.board
        const toBoard = toState.board

        let diverLocation: Point | undefined
        let startOffset = 0

        // Activating sundiver starts in cell
        const diverCoords = fromBoard.findSundiverCoords(this.id)
        const diverCell = fromBoard.cellAt(diverCoords!)
        diverLocation = this.gameSession.locationForDiverInCell(activate.playerId, diverCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState, activate.playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: isActivatingSundiver ? 1 : 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateBonusAction(
        activateBonus: ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!activateBonus.metadata) {
            return
        }

        this.animateCreatedSundivers(
            activateBonus.metadata.createdSundiverIds,
            activateBonus.metadata.coords,
            activateBonus.playerId,
            timeline,
            toState,
            fromState
        )
    }

    animateActivateEffectAction(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (action.effect !== EffectType.Squeeze && action.effect !== EffectType.Augment) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        this.animateCreatedSundivers(
            action.metadata.createdSundiverIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState
        )
    }

    animateDrawCardsAction(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (fromState?.activeEffect !== EffectType.Squeeze) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        this.animateCreatedSundivers(
            action.metadata.createdSundiverIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState
        )
    }

    animateCreatedSundivers(
        createdSundiverIds: string[],
        startCoords: OffsetCoordinates,
        playerId: string,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        const index = createdSundiverIds.indexOf(this.id)
        if (index === undefined || index < 0) {
            return
        }

        const board = this.gameSession.gameState.board

        let startOffset = index * 0.2
        const stationCell = board.cellAt(startCoords)
        const diverLocation = this.gameSession.locationForStationInCell(stationCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState ?? toState, playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: this.element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
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
