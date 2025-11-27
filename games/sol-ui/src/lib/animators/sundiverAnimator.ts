import { HydratedSolGameState, type SolGameState, type Sundiver } from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { sameCoordinates, type Point } from '@tabletop/common'
import { getCellLayout } from '$lib/utils/cellLayouts.js'
import { getMothershipSpotPoint, offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { move } from '$lib/utils/animations.js'
import { gsap } from 'gsap'

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
            gsap.set(this.element, { opacity: 0 })
        }
    }

    override async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        timeline: gsap.core.Timeline
    }) {
        if (!this.element) {
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

    getMothershipLocationForPlayer(gameState: HydratedSolGameState, playerId: string): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        const spotPoint = getMothershipSpotPoint(gameState.players.length, mothershipIndex)

        return {
            x: spotPoint.x,
            y: spotPoint.y
        }
    }
}
