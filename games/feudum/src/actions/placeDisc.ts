import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import type { GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import {
    currentFollowUp,
    drawWritsToKeep,
    finishFollowUp,
    isDiscFollowUp,
    nextMilitarySpace,
    nextVoyageSpace,
    reasonDiscRefused,
    reevePointsIn,
    requireDrawnWrits,
    type DiscFollowUp
} from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf } from '../model/guildStatus.js'
import { writDeckCount } from '../model/writDeck.js'
import { ComponentCount, GuildIdSchema, WritIdSchema } from '../model/stateSchemas.js'

export type PlaceDiscMetadata = Type.Static<typeof PlaceDiscMetadata>
export const PlaceDiscMetadata = Type.Object({
    /** R-4.7, R-4.9.1, R-3.7.5 What was offered; the input says only whether it was taken. */
    disc: Type.Union([Type.Literal('reeve'), Type.Literal('military'), Type.Literal('voyage')]),
    /** R-4.7 */
    guildId: Type.Optional(GuildIdSchema),
    /** R-4.7 What the reeve scored on placing. */
    reevePoints: Type.Optional(ComponentCount),
    /** R-4.9.1, R-3.7.5 The track space taken; absent when the disc was kept. */
    space: Type.Optional(Type.Integer({ minimum: 1 })),
    /** R-3.7.5, R-4.4-H2 Writs drawn by the step; the count is public, the writs are not. */
    drawnCount: Type.Optional(ComponentCount),
    /** R-3.7.5 Actor-known. */
    drawnWritIds: Type.Optional(
        Visibility.protect(Type.Array(WritIdSchema), { policy: Visibility.Policy.Actor })
    )
})

export type PlaceDisc = Type.Static<typeof PlaceDisc>
export const PlaceDisc = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceDisc),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceDiscMetadata),
            /** R-3.7.5 Optional, since discs are shared; false keeps the disc. */
            place: Type.Boolean()
        })
    ])
)

export const PlaceDiscValidator = Compile(PlaceDisc)

export function isPlaceDisc(action?: GameAction): action is PlaceDisc {
    return action?.type === ActionType.PlaceDisc
}

/** R-4.7 The disc this seat is being asked about, if any. */
function discAskedOf(state: HydratedFeudumGameState, playerId: string): DiscFollowUp | undefined {
    const followUp = currentFollowUp(state)
    return followUp && isDiscFollowUp(followUp) && followUp.playerId === playerId
        ? followUp
        : undefined
}

/** R-4.7, R-4.9.1, R-3.7.5 Keeping the disc is always legal for the seat asked. */
export function reasonPlaceDiscRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    place: boolean
): string | undefined {
    const followUp = discAskedOf(state, playerId)
    if (!followUp) {
        return 'No disc is offered to you.'
    }
    return place ? reasonDiscRefused(state, followUp) : undefined
}

/** R-4.7, R-4.9.1, R-3.7.5 What the seat asked is deciding, read from public state alone. */
export type PlaceDiscOffer =
    | {
          readonly disc: 'reeve'
          readonly guildId: GuildId
          readonly revealsInfo: false
      }
    | {
          readonly disc: 'military'
          /** R-4.9.1 The track space the disc would take. */
          readonly space: number
          /** R-4.9.2 What a disc on that space covers at a dawn. */
          readonly penalty: number
          readonly revealsInfo: false
      }
    | {
          readonly disc: 'voyage'
          /** R-3.7.5 The track space the disc would take. */
          readonly space: number
          /** R-3.7-H1 A disc is already on the track, so this takes no free disc. */
          readonly advances: boolean
          /** R-3.7.5, R-4.4-H2 Writs the step draws: what the deck has of what the space asks. */
          readonly draw: number
          /** R-X.2 A step that draws can't be undone; one on an empty deck can. */
          readonly revealsInfo: boolean
      }

/** R-4.7, R-4.9.1, R-3.7.5 None once no space is left: such a disc lapses unasked. */
export function placeDiscOffer(
    state: HydratedFeudumGameState,
    playerId: string
): PlaceDiscOffer | undefined {
    const followUp = discAskedOf(state, playerId)
    if (!followUp) {
        return undefined
    }
    switch (followUp.kind) {
        case 'reeve': {
            return { disc: 'reeve', guildId: followUp.guildId, revealsInfo: false }
        }
        case 'military': {
            const row = nextMilitarySpace(state, playerId)
            return (
                row && {
                    disc: 'military',
                    space: row.space,
                    penalty: row.penalty,
                    revealsInfo: false
                }
            )
        }
        case 'voyage': {
            const row = nextVoyageSpace(state, playerId)
            if (!row) {
                return undefined
            }
            const draw = Math.min(row.writDraw?.draw ?? 0, writDeckCount(state))
            return {
                disc: 'voyage',
                space: row.space,
                advances: Object.hasOwn(state.voyageTrack, playerId),
                draw,
                revealsInfo: draw > 0
            }
        }
    }
}

export class HydratedPlaceDisc extends HydratableAction<typeof PlaceDisc> implements PlaceDisc {
    declare type: ActionType.PlaceDisc
    declare playerId: string
    declare metadata?: PlaceDiscMetadata
    declare place: boolean

    constructor(data: PlaceDisc) {
        super(data, PlaceDiscValidator)
    }

    /** R-4.7, R-4.9.1, R-3.7.5 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonPlaceDiscRefused(state, this.playerId, this.place)
        if (reason) {
            throw Error(reason)
        }
        const followUp = discAskedOf(state, this.playerId)
        assert(followUp, 'R-4.7 The reason has found the disc asked')
        finishFollowUp(state)
        const offered = {
            disc: followUp.kind,
            ...(followUp.kind === 'reeve' ? { guildId: followUp.guildId } : {})
        }
        this.metadata = this.place ? { ...offered, ...this.placeDisc(state, followUp) } : offered
    }

    private placeDisc(
        state: HydratedFeudumGameState,
        followUp: DiscFollowUp
    ): Pick<PlaceDiscMetadata, 'space' | 'drawnCount' | 'drawnWritIds' | 'reevePoints'> {
        switch (followUp.kind) {
            case 'reeve': {
                return this.placeReeve(state, followUp.guildId)
            }
            case 'military': {
                return this.placeMilitary(state)
            }
            case 'voyage': {
                return this.stepVoyage(state)
            }
        }
    }

    /** R-4.7 The reeve sits on the marker and follows it, and scores for the threshold just reached. */
    private placeReeve(state: HydratedFeudumGameState, guildId: GuildId) {
        const track = state.guilds.tracks[guildId]
        const rank = rankOf(track, this.playerId)
        const holder = rank && track[rank]
        assert(holder, 'R-4.7 A reeve sits on the marker')
        holder.reeve = true
        const reevePoints = reevePointsIn(state, this.playerId, guildId)
        state.getPlayerState(this.playerId).score += reevePoints
        return { reevePoints }
    }

    /** R-4.9.1, R-4.9-H2 */
    private placeMilitary(state: HydratedFeudumGameState) {
        const row = nextMilitarySpace(state, this.playerId)
        assert(row, 'R-4.9.1 The reason has found a space')
        state.militaryService[this.playerId] = row.space
        return { space: row.space }
    }

    /** R-3.7.5, R-X.2 A draw is the only barrier here; R-4.4-H2 an empty deck draws nothing. */
    private stepVoyage(state: HydratedFeudumGameState) {
        const row = nextVoyageSpace(state, this.playerId)
        assert(row, 'R-3.7.5 The reason has found a space')
        state.voyageTrack[this.playerId] = row.space
        if (!row.writDraw) {
            return { space: row.space }
        }
        const drawnCount = drawWritsToKeep(state, this.playerId, row.writDraw, 'voyage')
        const { writDraw } = state.flow
        if (!writDraw) {
            return { space: row.space, drawnCount }
        }
        markRevealsInfo(this, true)
        return { space: row.space, drawnCount, drawnWritIds: [...requireDrawnWrits(writDraw)] }
    }
}
