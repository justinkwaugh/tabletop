import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export const MergerStage = Type.Union([
    /** The other minors' owners answer the proposal. */
    Type.Literal('consent'),
    /** The director chooses the stations the major company keeps. */
    Type.Literal('stations'),
    /** Shareholders, from the director, each buy any number of shares in one go. */
    Type.Literal('shareholders'),
    /** The company is formed; every player, from the director, may buy one share. */
    Type.Literal('open'),
    /** The formed company gives up the trains over its limit. */
    Type.Literal('discard')
])
export type MergerStage = Type.Static<typeof MergerStage>

export const ShareAllotment = Type.Object(
    { playerId: Id, shares: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type ShareAllotment = Type.Static<typeof ShareAllotment>

/**
 * A minor's conversion, or several minors' merger, from its proposal until its major company has
 * been formed (1861 §12, 1867 GTG §9).
 */
export const MergerProposal = Type.Object(
    {
        kind: Type.Union([Type.Literal('convert'), Type.Literal('merge')]),
        /** The minor whose turn it is in the round. */
        minorId: Id,
        /** Every minor becoming the major company, in operating order. */
        minorIds: Type.Array(Id, { minItems: 1, uniqueItems: true }),
        majorId: Id,
        marketSpaceId: Id,
        stage: MergerStage,
        directorId: Id,
        /** The players still to answer or to decide in this stage, the next first. */
        pendingPlayerIds: Type.Array(Id, { uniqueItems: true }),
        /** The minors' stations the major company keeps, once chosen. */
        stationIds: Type.Optional(Type.Array(Id, { uniqueItems: true })),
        /** The shares each player holds once the company forms: one a minor, and those bought. */
        allotments: Type.Array(ShareAllotment)
    },
    { additionalProperties: false }
)
export type MergerProposal = Type.Static<typeof MergerProposal>

/** A merger round after an operating round, in which minors may convert or merge. */
export const MergerRound = Type.Object(
    {
        set: Type.Integer({ minimum: 1 }),
        round: Type.Integer({ minimum: 1 }),
        /** The minors still to be offered to their owners, in operating order. */
        minorIds: Type.Array(Id, { uniqueItems: true }),
        proposal: Type.Optional(MergerProposal),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type MergerRound = Type.Static<typeof MergerRound>

export const MergerRoundFields = { mergerRound: Type.Optional(MergerRound) }
/** The state of a title that holds merger rounds, as 1861 and 1867 do. */
export type MergerRoundState = Type.Static<Type.TObject<typeof MergerRoundFields>>

export const MergerRoundMachineState = 'MergerRound'
export const MergerRoundMachineStates = [MergerRoundMachineState] as const

export function validateMergerRound(state: {
    machineState: string
    mergerRound?: MergerRound
}): void {
    const round = state.mergerRound
    const active = !!round && !round.completed
    assert(
        active === (state.machineState === MergerRoundMachineState),
        'A merger round in progress belongs to its own state'
    )
    if (round?.proposal)
        assert(
            round.proposal.minorIds.includes(round.proposal.minorId),
            'A proposal includes the minor whose turn it is'
        )
}
