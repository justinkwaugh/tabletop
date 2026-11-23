import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { VesselTypes, type VesselType } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { inOwnTurnWindow, reasonNoAtWillWindow } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeVesselUnderPawn } from '../model/media.js'
import type { PawnState } from '../model/playerState.js'
import { PawnNumberSchema, SpaceIdSchema, VesselTypeSchema } from '../model/stateSchemas.js'
import { spaced } from '../model/words.js'

export type PlaceVesselMetadata = Type.Static<typeof PlaceVesselMetadata>
export const PlaceVesselMetadata = Type.Object({
    /** R-4.2.2 Where the pawn stands, for the sentence. */
    spaceId: SpaceIdSchema
})

export type PlaceVessel = Type.Static<typeof PlaceVessel>
export const PlaceVessel = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceVessel),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceVesselMetadata),
            vesselType: VesselTypeSchema,
            pawn: PawnNumberSchema
        })
    ])
)

export const PlaceVesselValidator = Compile(PlaceVessel)

export function isPlaceVessel(action?: GameAction): action is PlaceVessel {
    return action?.type === ActionType.PlaceVessel
}

function pawnOnNoVessel(pawn: PawnState): boolean {
    return pawn.spaceId !== undefined && pawn.vessel === undefined
}

/** R-4.2.2 A vessel the seat holds and the pawns that could take it. */
export interface PlaceVesselOffer {
    readonly vesselType: VesselType
    readonly pawns: readonly PawnState['n'][]
}

/** R-4.2.2 Each vessel held, on the own turn, with pawns on no vessel. Read-only. */
export function placeVesselOffers(
    state: HydratedFeudumGameState,
    playerId: string
): PlaceVesselOffer[] {
    if (!inOwnTurnWindow(state, playerId)) {
        return []
    }
    const player = state.getPlayerState(playerId)
    const pawns = player.pawns.filter(pawnOnNoVessel).map(({ n }) => n)
    if (pawns.length === 0) {
        return []
    }
    return VesselTypes.filter((vesselType) => player.vessels[vesselType] > 0).map((vesselType) => ({
        vesselType,
        pawns
    }))
}

export class HydratedPlaceVessel
    extends HydratableAction<typeof PlaceVessel>
    implements PlaceVessel
{
    declare type: ActionType.PlaceVessel
    declare playerId: string
    declare metadata?: PlaceVesselMetadata
    declare vesselType: VesselType
    declare pawn: PawnState['n']

    constructor(data: PlaceVessel) {
        super(data, PlaceVesselValidator)
    }

    /** R-4.2.2 Free; the pawn stays where it is, now on the vessel. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = HydratedPlaceVessel.reasonRefused(
            state,
            this.playerId,
            this.vesselType,
            this.pawn
        )
        if (reason) {
            throw Error(reason)
        }
        const player = state.getPlayerState(this.playerId)
        const pawn = player.pawns.find(({ n }) => n === this.pawn)
        const spaceId: SpaceId | undefined = pawn?.spaceId
        assertExists(pawn, 'R-1.1 The reason has found the pawn')
        assertExists(spaceId, 'R-4.2.2 The reason has found it on the board')
        placeVesselUnderPawn(player, pawn, this.vesselType)
        this.metadata = { spaceId }
    }

    /** R-4.2.2, R-4.2-H3 On the seat's own turn, a vessel held, under its pawn on no vessel. */
    private static reasonRefused(
        state: HydratedFeudumGameState,
        playerId: string,
        vesselType: VesselType,
        pawnNumber: PawnState['n']
    ): string | undefined {
        const closed = reasonNoAtWillWindow(state, playerId)
        if (closed) {
            return closed
        }
        if (!inOwnTurnWindow(state, playerId)) {
            return 'You place a vessel only on your own turn.'
        }
        const player = state.getPlayerState(playerId)
        if (player.vessels[vesselType] === 0) {
            return `You have no ${spaced(vesselType)} in your supply.`
        }
        const pawn = player.pawns.find(({ n }) => n === pawnNumber)
        if (pawn?.spaceId === undefined) {
            return "That pawn isn't on the board."
        }
        return pawn.vessel === undefined ? undefined : 'That pawn already stands on a vessel.'
    }
}
