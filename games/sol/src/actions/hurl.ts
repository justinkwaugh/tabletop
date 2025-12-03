import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'
import { CENTER_COORDS } from '../components/gameBoard.js'

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
            gates: Type.Optional(Type.Array(SolarGate)), // Ordered list of required gates to pass through
            start: OffsetCoordinates,
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
    declare gates?: SolarGate[]
    declare start: OffsetCoordinates
    declare metadata?: HurlMetadata

    constructor(data: Hurl) {
        super(data, HurlValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const pathLength = this.pathLengthToCenter(state)
        if (!pathLength) {
            throw Error('Invalid hurl')
        }

        // These divers are gone for good
        state.board.removeSundiversAt(this.sundiverIds, this.start)

        playerState.movementPoints -= this.sundiverIds.length * pathLength
        playerState.momentum = (playerState.momentum ?? 0) + this.sundiverIds.length

        state.hurled = true
        state.cardsToDraw = (state.cardsToDraw ?? 0) + this.sundiverIds.length

        const paidPlayerIds = new Set<string>()
        for (const gate of this.gates ?? []) {
            if (gate.playerId !== this.playerId && !paidPlayerIds.has(gate.playerId)) {
                const gateOwner = state.getPlayerState(gate.playerId)
                gateOwner.energyCubes += 1
                paidPlayerIds.add(gate.playerId)
            }
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
                    range: playerState.movementPoints
                })
            ) {
                return true
            }
        }
        return false
    }

    pathLengthToCenter(state: HydratedSolGameState): number {
        const playerState = state.getPlayerState(this.playerId)
        const path = state.board.pathToDestination({
            start: this.start,
            destination: CENTER_COORDS,
            range: playerState.movementPoints / this.sundiverIds.length,
            requiredGates: this.gates
        })
        return path ? path.length - 1 : 0
    }
}
