import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'
import { CENTER_COORDS } from '../components/gameBoard.js'
import { EffectType } from '../components/effects.js'
import { HydratedFly } from './fly.js'

export type HurlMetadata = Static<typeof HurlMetadata>
export const HurlMetadata = Type.Object({})

export type Hurl = Static<typeof Hurl>
export const Hurl = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Hurl),
            playerId: Type.String(),
            sundiverIds: Type.Array(Type.String()),
            stationId: Type.Optional(Type.String()),
            gates: Type.Array(SolarGate), // Ordered list of required gates to pass through
            start: OffsetCoordinates,
            cluster: Type.Boolean(),
            metadata: Type.Optional(HurlMetadata)
        })
    ])
)

export const HurlValidator = Compile(Hurl)

export function isHurl(action?: GameAction): action is Hurl {
    return action?.type === ActionType.Hurl
}

export class HydratedHurl extends HydratableAction<typeof Hurl> implements Hurl {
    declare type: ActionType.Hurl
    declare playerId: string
    declare sundiverIds: string[]
    declare stationId?: string
    declare gates: SolarGate[]
    declare start: OffsetCoordinates
    declare cluster: boolean
    declare metadata?: HurlMetadata

    constructor(data: Hurl) {
        super(data, HurlValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const path = this.isValidHurl(state)
        if (!path || path.length < 2) {
            throw Error('Invalid hurl')
        }
        state.moved = true

        // These divers are gone for good
        if (this.stationId) {
            state.board.removeStationAt(this.start)
            state.activeEffect = undefined
        } else {
            state.board.removeSundiversAt(this.sundiverIds, this.start)
        }

        const distanceMoved = this.sundiverIds.length * (path.length - 1)
        playerState.movementPoints -= distanceMoved
        playerState.momentum += this.sundiverIds.length

        state.hurled = true
        state.cardsToDraw += this.sundiverIds.length

        for (const gate of this.gates) {
            if (gate.playerId !== this.playerId && !state.paidPlayerIds.includes(gate.playerId)) {
                const gateOwner = state.getPlayerState(gate.playerId)
                gateOwner.energyCubes += 1
                state.paidPlayerIds.push(gate.playerId)
            }
        }

        if (state.activeEffect === EffectType.Hyperdrive) {
            state.getEffectTracking().flownSundiverId = this.sundiverIds[0]
            state.getEffectTracking().movementUsed += distanceMoved
        }
    }

    static canHurl(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        for (const cell of state.board) {
            if (state.board.sundiversForPlayer(playerId, cell).length === 0) {
                continue
            }

            if (
                state.board.pathToDestination({
                    start: cell.coords,
                    destination: CENTER_COORDS,
                    range: playerState.movementPoints,
                    portal: state.activeEffect === EffectType.Portal
                })
            ) {
                return true
            }
        }
        return false
    }

    isValidHurl(state: HydratedSolGameState): OffsetCoordinates[] | undefined {
        const playerState = state.getPlayerState(this.playerId)

        if (
            this.cluster &&
            (state.activeEffect !== EffectType.Cluster || !state.effectTracking?.clustersRemaining)
        ) {
            return
        }

        if (
            state.activeEffect === EffectType.Hyperdrive &&
            (this.sundiverIds.length !== 1 ||
                (state.effectTracking?.flownSundiverId &&
                    state.effectTracking?.flownSundiverId !== this.sundiverIds[0]))
        ) {
            return
        }

        if (
            !HydratedFly.isValidFlightDestination({
                state,
                playerId: this.playerId,
                numSundivers: this.sundiverIds.length,
                start: this.start,
                destination: CENTER_COORDS,
                cluster: this.cluster,
                juggernaut: this.stationId !== undefined
            })
        ) {
            return
        }

        const illegalCoordinates: OffsetCoordinates[] = []
        if (this.stationId !== undefined || state.activeEffect === EffectType.Hyperdrive) {
            // No 5 diver spots for juggernaut or hyperdrive
            illegalCoordinates.push(...state.board.getFiveDiverCoords(this.playerId))
        }

        const piecesMoving = this.stationId ? 1 : this.sundiverIds.length
        return state.board.pathToDestination({
            start: this.start,
            destination: CENTER_COORDS,
            range: playerState.movementPoints / piecesMoving,
            requiredGates: this.gates,
            portal: state.activeEffect === EffectType.Portal,
            illegalCoordinates
        })
    }
}
