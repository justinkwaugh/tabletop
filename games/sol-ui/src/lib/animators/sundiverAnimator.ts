import {
    Activate,
    ActivateBonus,
    Convert,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isConvert,
    type SolGameState,
    type Sundiver
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, sameCoordinates, type Point } from '@tabletop/common'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, move } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import { act } from 'react'

export class SundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    constructor(
        gameSession: SolGameSession,
        private id: string
    ) {
        super(gameSession)
    }

    override onAttach(): void {
        if (this.element) {
            console.log(`Hiding sundiver ${this.id} on attach`)
            gsap.set(this.element, { opacity: 0 })
        }
    }

    override async onGameStateChange({
        to,
        from,
        actions,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        actions?: GameAction[]
        timeline: gsap.core.Timeline
    }) {
        if (!this.element) {
            return
        }

        if (actions && actions.length > 0) {
            this.animateActions(actions, timeline, to, from)
            return
        }

        const toSundiver: Sundiver | undefined = Iterator.from(to.getAllSundivers()).find(
            (d) => d.id === this.id
        )
        const fromSundiver: Sundiver | undefined = Iterator.from(
            from?.getAllSundivers() ?? []
        ).find((d) => d.id === this.id)
        let fromLocation: Point | undefined
        let toLocation: Point | undefined
        let hide = false

        // Figure out where we are going
        if (toSundiver) {
            // In a cell
            if (toSundiver.coords) {
                if (sameCoordinates(fromSundiver?.coords, toSundiver.coords)) {
                    return
                }
                const cell = to.board.cellAt(toSundiver.coords)
                if (cell) {
                    toLocation = this.gameSession.locationForDiverInCell(toSundiver.playerId, cell)
                }
                // In a hold
            } else if (toSundiver.hold) {
                if (fromSundiver?.hold === toSundiver.hold) {
                    return
                }
                toLocation = this.getMothershipLocationForPlayer(to, toSundiver.hold)
                hide = true
            } else if (toSundiver.reserve) {
                // We need some idea of what happened.  We may need to do something like
                // move to the converted station and disappear
                if (!fromSundiver?.coords) {
                    return
                }
                hide = true
            }
        }

        if (fromSundiver) {
            if (fromSundiver.coords) {
                const fromCell = from?.board.cellAt(fromSundiver.coords)
                if (fromCell) {
                    fromLocation = this.gameSession.locationForDiverInCell(
                        fromSundiver.playerId,
                        fromCell
                    )
                }
            } else if (fromSundiver.hold) {
                gsap.set(this.element, { opacity: 1 })
                fromLocation = this.getMothershipLocationForPlayer(from!, fromSundiver.hold)
            }
        }

        if (fromLocation) {
            const changes = Object.assign({}, offsetFromCenter(fromLocation), {
                opacity: 1
            })
            gsap.set(this.element, changes)
        }

        if (toLocation) {
            move({
                object: this.element,
                location: offsetFromCenter(toLocation),
                duration: 0.5,
                timeline,
                position: 'movingPieces'
            })
        }
        if (hide) {
            timeline.to(this.element, {
                opacity: 0,
                duration: 0,
                position: '>'
            })
        }
    }

    animateActions(
        actions: GameAction[],
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        for (const action of actions) {
            if (isConvert(action)) {
                this.animateConvertAction(action, timeline)
            } else if (isActivate(action)) {
                this.animateActivateAction(action, timeline, toState, fromState)
            } else if (isActivateBonus(action)) {
                this.animateActivateBonusAction(action, timeline, toState, fromState)
            }
        }
    }

    animateConvertAction(convert: Convert, timeline: gsap.core.Timeline) {
        if (!convert.sundiverIds.includes(this.id)) {
            return
        }

        const board = this.gameSession.gameState.board

        const diverCoords = board.findSundiverCoords(this.id)
        const diverCell = board.cellAt(diverCoords!)
        const diverLocation = this.gameSession.locationForDiverInCell(convert.playerId, diverCell)

        let targetLocation: Point | undefined
        if (!convert.isGate) {
            const stationCell = board.cellAt(convert.coords)
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
        if (
            activate.metadata?.sundiverId !== this.id &&
            !activate.metadata?.createdSundiverIds.includes(this.id)
        ) {
            return
        }

        const board = this.gameSession.gameState.board

        let diverLocation: Point | undefined
        let startOffset = 0

        if (activate.metadata?.sundiverId === this.id) {
            // Activating sundiver starts in cell
            const diverCoords = board.findSundiverCoords(this.id)
            const diverCell = board.cellAt(diverCoords!)
            diverLocation = this.gameSession.locationForDiverInCell(activate.playerId, diverCell)
        } else {
            // Newly created sundiver - appear at the foundry
            const createdIndex = activate.metadata?.createdSundiverIds.indexOf(this.id)
            startOffset = (createdIndex + 1) * 0.2
            const stationCell = board.cellAt(activate.coords)
            diverLocation = this.gameSession.locationForStationInCell(stationCell)
        }

        const targetLocation = this.getMothershipLocationForPlayer(
            fromState ?? toState,
            activate.playerId
        )

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
        const index = activateBonus.metadata?.createdSundiverIds.indexOf(this.id)
        if (index === undefined || index < 0) {
            return
        }

        const board = this.gameSession.gameState.board

        let startOffset = index * 0.2
        const stationCell = board.cellAt(activateBonus.metadata!.coords)
        const diverLocation = this.gameSession.locationForStationInCell(stationCell)

        const targetLocation = this.getMothershipLocationForPlayer(
            fromState ?? toState,
            activateBonus.playerId
        )

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
