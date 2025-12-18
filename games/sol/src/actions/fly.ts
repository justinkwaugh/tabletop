import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { gateKey, SolarGate } from '../components/solarGate.js'
import { EffectType } from '../components/effects.js'
import { Direction, Ring } from '../utils/solGraph.js'
import { CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'

export type FlyMetadata = Static<typeof FlyMetadata>
export const FlyMetadata = Type.Object({
    flightPath: Type.Array(OffsetCoordinates),
    puncturedGate: Type.Optional(SolarGate)
})

export type Fly = Static<typeof Fly>
export const Fly = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Fly),
            playerId: Type.String(),
            sundiverIds: Type.Array(Type.String()),
            stationId: Type.Optional(Type.String()), // For juggernaut effect
            gates: Type.Array(SolarGate), // Ordered list of required gates to pass through
            start: OffsetCoordinates,
            destination: OffsetCoordinates,
            cluster: Type.Boolean(),
            teleport: Type.Boolean(),
            catapult: Type.Boolean(),
            passage: Type.Boolean(),
            metadata: Type.Optional(FlyMetadata)
        })
    ])
)

export const FlyValidator = Compile(Fly)

export function isFly(action?: GameAction): action is Fly {
    return action?.type === ActionType.Fly
}

const EffectsThatDisallowFiveDiverTraversal = [
    EffectType.Hyperdrive,
    EffectType.Catapult,
    EffectType.Passage
]
export class HydratedFly extends HydratableAction<typeof Fly> implements Fly {
    declare type: ActionType.Fly
    declare playerId: string
    declare sundiverIds: string[]
    declare stationId?: string
    declare gates: SolarGate[]
    declare start: OffsetCoordinates
    declare destination: OffsetCoordinates
    declare cluster: boolean
    declare teleport: boolean
    declare catapult: boolean
    declare passage: boolean
    declare metadata?: FlyMetadata

    constructor(data: Fly) {
        super(data, FlyValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const path = this.isValidFlight(state)
        if (!path) {
            throw Error('Invalid flight')
        }

        state.moved = true
        this.metadata = {
            flightPath: path
        }

        if (this.passage) {
            // Initialize passage sundiver tracking
            state.getEffectTracking().passageSundiverId = this.sundiverIds[0]
        }

        const distanceMoved = path.length - 1

        if (this.cluster) {
            playerState.movementPoints -= distanceMoved
            state.getEffectTracking().clustersRemaining -= 1
        } else if (this.teleport) {
            playerState.movementPoints -= 3
        } else {
            for (const sundiverId of this.sundiverIds) {
                let sundiverMovement = distanceMoved
                if (this.catapult && this.gates.length > 0) {
                    if (!state.getEffectTracking().catapultedIds.includes(sundiverId)) {
                        state.getEffectTracking().catapultedIds.push(sundiverId)
                        sundiverMovement -= 1
                    }
                }
                playerState.movementPoints -= sundiverMovement
            }

            if (this.stationId) {
                // Juggernaut
                playerState.movementPoints -= distanceMoved
            }
        }

        if (state.activeEffect === EffectType.Puncture) {
            const removedSundivers = state.board.removeSundiversAt(this.sundiverIds, this.start)
            playerState.addSundiversToReserve(removedSundivers)
            const playerGate = playerState.removeSolarGate()
            this.metadata.puncturedGate = playerGate

            if (this.start.row < this.destination.row) {
                state.board.addGateAt(playerGate, this.start, this.destination)
            } else {
                state.board.addGateAt(playerGate, this.destination, this.start)
            }
            state.activeEffect = undefined
            state.cardsToDraw +=
                CARDS_DRAWN_PER_RING[Math.min(this.start.row, this.destination.row)]
        } else {
            if (this.stationId) {
                // Juggernaut
                const station = state.board.removeStationAt(this.start)
                if (!station || station.id !== this.stationId) {
                    throw Error('Invalid juggernaut station')
                }
                state.board.addStationAt(station, this.destination)
                state.activeEffect = undefined
            } else {
                const removedSundivers = state.board.removeSundiversAt(this.sundiverIds, this.start)
                state.board.addSundiversToCell(removedSundivers, this.destination)
            }
        }
        if (state.activeEffect === EffectType.Hyperdrive) {
            state.getEffectTracking().flownSundiverId = this.sundiverIds[0]
            state.getEffectTracking().movementUsed += distanceMoved
        }

        // Find all the gates traversed
        const gates = state.board.gatesForPath(path)

        for (const gate of gates) {
            if (gate.playerId !== this.playerId && !state.paidPlayerIds.includes(gate.playerId)) {
                const gateOwner = state.getPlayerState(gate.playerId)
                gateOwner.energyCubes += 1
                state.paidPlayerIds.push(gate.playerId)
            }

            const key = gateKey(gate.innerCoords, gate.outerCoords)
            if (
                this.hasPassageSundiver(state) &&
                !state.getEffectTracking().passageGates.includes(key)
            ) {
                state.getEffectTracking().passageGates.push(key)
                playerState.momentum += 1
            }
        }
    }

    hasPassageSundiver(state: HydratedSolGameState): boolean {
        const passageSundiverId = state.getEffectTracking().passageSundiverId
        if (!passageSundiverId) {
            return false
        }
        return this.sundiverIds.includes(passageSundiverId)
    }

    static canFly(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (playerState.movementPoints <= 0) {
            if (state.activeEffect === EffectType.Catapult) {
                if (this.hasUncatapultedSundiverNextToGate(state, playerId)) {
                    return true
                }
            }
            return false
        }

        for (const cell of state.board) {
            const sundiversInCell = state.board.sundiversForPlayerAt(playerId, cell.coords)
            if (sundiversInCell.length > 0) {
                return true
            }
        }
        return false
    }

    isValidFlight(state: HydratedSolGameState): OffsetCoordinates[] | undefined {
        const playerState = state.getPlayerState(this.playerId)

        if (
            this.passage &&
            (state.getEffectTracking().passageSundiverId || this.sundiverIds.length !== 1)
        ) {
            console.log('invalid passage flight')
            return
        }

        if (this.teleport) {
            if (playerState.movementPoints < 3 || this.sundiverIds.length > 1) {
                return
            }
            return [this.start, this.destination]
        }

        if (
            this.cluster &&
            (state.activeEffect !== EffectType.Cluster || !state.effectTracking?.clustersRemaining)
        ) {
            console.log('no more clusters remaining')
            return
        }

        if (
            state.activeEffect === EffectType.Hyperdrive &&
            (this.sundiverIds.length !== 1 ||
                (state.effectTracking?.flownSundiverId &&
                    state.effectTracking?.flownSundiverId !== this.sundiverIds[0]))
        ) {
            console.log('invalid hyperdrive flight')
            return
        }

        if (
            !HydratedFly.isValidFlightDestination({
                state,
                playerId: this.playerId,
                numSundivers: this.sundiverIds.length,
                start: this.start,
                destination: this.destination,
                cluster: this.cluster,
                juggernaut: this.stationId !== undefined,
                catapult: this.catapult
            })
        ) {
            console.log('invalid flight destination')
            return
        }

        if (state.activeEffect === EffectType.Puncture) {
            return [this.start, this.destination]
        }

        const numMovingPieces = this.stationId ? 1 : this.sundiverIds.length

        const illegalCoordinates: OffsetCoordinates[] = []

        if (
            this.stationId !== undefined ||
            (state.activeEffect &&
                EffectsThatDisallowFiveDiverTraversal.includes(state.activeEffect))
        ) {
            // No 5 diver spots for juggernaut or hyperdrive
            illegalCoordinates.push(...state.board.getFiveDiverCoords(this.playerId))
        }

        return state.board.pathToDestination({
            start: this.start,
            destination: this.destination,
            range:
                playerState.movementPoints / numMovingPieces +
                (this.catapult && this.gates && this.gates.length > 0 ? 1 : 0),
            requiredGates: this.gates,
            portal: state.activeEffect === EffectType.Portal,
            illegalCoordinates,
            transcend: state.activeEffect === EffectType.Transcend
        })
    }

    static isValidFlightDestination({
        state,
        playerId,
        numSundivers,
        start,
        destination,
        cluster = false,
        juggernaut = false,
        catapult = false
    }: {
        state: HydratedSolGameState
        playerId: string
        numSundivers: number
        start: OffsetCoordinates
        destination: OffsetCoordinates
        cluster?: boolean
        juggernaut?: boolean
        catapult?: boolean
    }): boolean {
        const playerState = state.getPlayerState(playerId)

        if (state.activeEffect === EffectType.Puncture) {
            return this.isValidPuncture({ state, playerId, numSundivers, start, destination })
        }

        // Check to see if destination can hold the pieces
        if (juggernaut && !state.board.canAddStationToCell(destination)) {
            console.log('Cannot add station to cell')
            return false
        } else if (
            !juggernaut &&
            !state.board.canAddSundiversToCell(playerId, numSundivers, destination)
        ) {
            console.log('Cannot add sundivers to cell')
            return false
        }

        // Check range
        let range = playerState.movementPoints
        if (cluster) {
            range = 1
        } else {
            const numMovingPieces = juggernaut ? 1 : numSundivers
            range = Math.floor(range / numMovingPieces)
        }
        const portal = state.activeEffect === EffectType.Portal

        const illegalCoordinates: OffsetCoordinates[] = []
        if (
            juggernaut ||
            (state.activeEffect &&
                EffectsThatDisallowFiveDiverTraversal.includes(state.activeEffect))
        ) {
            illegalCoordinates.push(...state.board.getFiveDiverCoords(playerId))
        }

        // With catapult we try first with extra range.  If that succeeds and there was a gate, then it's valid.
        // If no gate, then we try again without extra range to be sure.
        let path
        if (catapult) {
            console.log('Trying catapult flight with extra range')
            const firstTry = state.board.pathToDestination({
                start,
                destination,
                range: range + 1,
                portal,
                illegalCoordinates,
                transcend: state.activeEffect === EffectType.Transcend
            })

            if (firstTry) {
                // See if any gates were passed through
                for (let i = 0; i < firstTry.length - 1; i++) {
                    if (state.board.hasGateBetween(firstTry[i], firstTry[i + 1])) {
                        path = firstTry
                        break
                    }
                }
            }
        }

        // Normal path, or catapult without gate
        if (!path) {
            path = state.board.pathToDestination({
                start,
                destination,
                range,
                portal,
                illegalCoordinates,
                transcend: state.activeEffect === EffectType.Transcend
            })
        }

        return path !== undefined && path.length > 1
    }

    static isValidPuncture({
        state,
        playerId,
        numSundivers,
        start,
        destination
    }: {
        state: HydratedSolGameState
        playerId: string
        numSundivers: number
        start: OffsetCoordinates
        destination: OffsetCoordinates
    }) {
        const playerState = state.getPlayerState(playerId)
        // Adjacent across barrier without gate, 1 movement point
        if (
            playerState.movementPoints < 1 ||
            playerState.solarGates.length === 0 ||
            numSundivers > 1
        ) {
            return false
        }
        const startCell = state.board.cellAt(start)
        const destinationCell = state.board.cellAt(destination)
        if (startCell.coords.row === Ring.Outer || destinationCell.coords.row === Ring.Outer) {
            return false
        }
        if (Math.abs(startCell.coords.row - destinationCell.coords.row) !== 1) {
            return false
        }
        if (!state.board.areNeighbors(start, destination)) {
            return false
        }
        if (state.board.hasGateBetween(start, destination)) {
            return false
        }
        return true
    }

    static canPunctureFrom(
        coords: OffsetCoordinates,
        state: HydratedSolGameState,
        playerId: string
    ): boolean {
        if (coords.row === Ring.Outer) {
            return false
        }
        const sundivers = state.board.sundiversForPlayerAt(playerId, coords)
        if (sundivers.length === 0) {
            return false
        }
        const neighbors = [
            ...state.board.neighborsAt(coords, Direction.In),
            ...state.board.neighborsAt(coords, Direction.Out)
        ]
        for (const neighbor of neighbors) {
            if (!state.board.hasGateBetween(coords, neighbor.coords)) {
                return true
            }
        }

        return false
    }

    static canTeleport(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.movementPoints >= 3
    }

    static hasUncatapultedSundiverNextToGate(
        state: HydratedSolGameState,
        playerId: string
    ): boolean {
        // Need a non-catapulted diver next to a gate
        for (const cell of state.board) {
            if (cell.coords.row === Ring.Outer) {
                continue
            }
            const sundiversInCell = state.board.sundiversForPlayerAt(playerId, cell.coords)
            const nonCatapultedDivers = sundiversInCell.filter(
                (diver) => !state.getEffectTracking().catapultedIds.includes(diver.id)
            )
            if (nonCatapultedDivers.length === 0) {
                continue
            }
            const neighbors = [
                ...state.board.neighborsAt(cell.coords, Direction.Out),
                ...(cell.coords.row === Ring.Core
                    ? []
                    : state.board.neighborsAt(cell.coords, Direction.In))
            ]
            for (const neighbor of neighbors) {
                if (state.board.hasGateBetween(cell.coords, neighbor.coords)) {
                    return true
                }
            }
        }
        return false
    }
}
