import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
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
import { Station } from '../components/stations.js'

export type HurlMetadata = Type.Static<typeof HurlMetadata>
export const HurlMetadata = Type.Object({
    flightPath: Type.Array(OffsetCoordinates),
    portal: Type.Boolean(),
    momentumGained: Type.Number(),
    paidPlayerIds: Type.Array(Type.String()),
    juggernaut: Type.Optional(Station),
    energyGained: Type.Optional(Type.Number()),
    passage: Type.Optional(Type.Boolean()),
    transcend: Type.Optional(Type.Boolean())
})

export type Hurl = Type.Static<typeof Hurl>
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
        assertExists(path, 'Invalid hurl')
        assert(path.length >= 2, 'Invalid hurl path length')

        this.metadata = {
            flightPath: path,
            portal: state.activeEffect === EffectType.Portal,
            momentumGained: 0,
            paidPlayerIds: [],
            transcend: state.activeEffect === EffectType.Transcend
        }

        HydratedFly.handleFlightEffects(state, this, path)

        const piecesHurled = this.stationId ? 1 : this.sundiverIds.length

        // Hurled pieces are removed from the game for good
        if (this.stationId) {
            const station = state.board.removeStationAt(this.start)
            assertExists(station, 'Cannot find juggernaut station')
            assert(station.id === this.stationId, 'Invalid juggernaut station')
            this.metadata.juggernaut = station
            state.activeEffect = undefined
            playerState.movement = state.calculatePlayerMovement(this.playerId)
        } else {
            state.board.removeSundiversAt(this.sundiverIds, this.start)
        }

        playerState.momentum += piecesHurled * 2
        this.metadata.momentumGained += piecesHurled * 2

        state.hurled = true
        state.cardsToDraw += piecesHurled
    }

    static canHurl(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const portal = state.activeEffect === EffectType.Portal
        const transcend = state.activeEffect === EffectType.Transcend

        for (const cell of state.board) {
            const hasSundivers = state.board.sundiversForPlayer(playerId, cell).length > 0
            const hasJuggernautStation = HydratedFly.isMovableJuggernautStation(
                state,
                playerId,
                cell.station
            )

            if (hasSundivers && state.activeEffect === EffectType.Teleport) {
                return true
            }

            // This still needs work because of effects like catapult
            if (
                hasSundivers &&
                state.board.pathToDestination({
                    start: cell.coords,
                    destination: CENTER_COORDS,
                    range: playerState.movementPoints,
                    portal,
                    transcend
                })
            ) {
                return true
            }

            if (
                hasJuggernautStation &&
                state.board.pathToDestination({
                    start: cell.coords,
                    destination: CENTER_COORDS,
                    range: playerState.movementPoints,
                    portal,
                    transcend,
                    illegalCoordinates: state.board.getFiveDiverCoords(playerId)
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

        return HydratedFly.isValidFlight(state, hurl)
    }
}
