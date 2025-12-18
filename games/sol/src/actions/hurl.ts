import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'
import { CENTER_COORDS } from '../components/gameBoard.js'
import { EffectType } from '../components/effects.js'
import { HydratedFly } from './fly.js'

export type HurlMetadata = Static<typeof HurlMetadata>
export const HurlMetadata = Type.Object({
    flightPath: Type.Array(OffsetCoordinates)
})

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
            destination: OffsetCoordinates,
            cluster: Type.Boolean(),
            teleport: Type.Boolean(),
            catapult: Type.Boolean(),
            passage: Type.Boolean(),
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
    declare destination: OffsetCoordinates
    declare cluster: boolean
    declare teleport: boolean
    declare catapult: boolean
    declare passage: boolean
    declare metadata?: HurlMetadata

    constructor(data: Hurl) {
        super(data, HurlValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const path = HydratedHurl.isValidHurl(state, this)
        if (!path || path.length < 2) {
            throw Error('Invalid hurl')
        }
        this.metadata = {
            flightPath: path
        }

        HydratedFly.handleFlightEffects(state, this, path)

        // These pieces are gone for good
        if (this.stationId) {
            state.board.removeStationAt(this.start)
            state.activeEffect = undefined
        } else {
            state.board.removeSundiversAt(this.sundiverIds, this.start)
        }

        playerState.momentum += this.sundiverIds.length

        state.hurled = true
        state.cardsToDraw += this.sundiverIds.length
    }

    static canHurl(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        for (const cell of state.board) {
            if (state.board.sundiversForPlayer(playerId, cell).length === 0) {
                continue
            }

            // This still needs work because of effects like catapult
            if (
                state.board.pathToDestination({
                    start: cell.coords,
                    destination: CENTER_COORDS,
                    range: playerState.movementPoints,
                    portal: state.activeEffect === EffectType.Portal,
                    transcend: state.activeEffect === EffectType.Transcend
                })
            ) {
                return true
            }
        }
        return false
    }

    static isValidHurl(state: HydratedSolGameState, hurl: Hurl): OffsetCoordinates[] | undefined {
        if (!sameCoordinates(hurl.destination, CENTER_COORDS)) {
            return
        }

        if (hurl.teleport) {
            return
        }
        return HydratedFly.isValidFlight(state, hurl)
    }
}
