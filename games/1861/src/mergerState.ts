import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export const MergerStage1861 = Type.Union([
    /** The other minors' owners answer the proposal. */
    Type.Literal('consent'),
    /** The director chooses the two stations the public company keeps. */
    Type.Literal('stations'),
    /** Shareholders, from the director, each buy any number of shares in one go. */
    Type.Literal('shareholders'),
    /** The company is formed; every player, from the director, may buy one share. */
    Type.Literal('open'),
    /** The formed company gives up the trains over its limit. */
    Type.Literal('discard')
])
export type MergerStage1861 = Type.Static<typeof MergerStage1861>

export const ShareAllotment1861 = Type.Object(
    { playerId: Id, shares: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type ShareAllotment1861 = Type.Static<typeof ShareAllotment1861>

/** A conversion or merger from its proposal until its public company has been formed (§12). */
export const MergerProposal1861 = Type.Object(
    {
        kind: Type.Union([Type.Literal('convert'), Type.Literal('merge')]),
        /** The minor whose turn it is in the round. */
        minorId: Id,
        /** Every minor becoming the public company, in operating order. */
        minorIds: Type.Array(Id, { minItems: 1, uniqueItems: true }),
        majorId: Id,
        marketSpaceId: Id,
        stage: MergerStage1861,
        directorId: Id,
        /** The players still to answer or to decide in this stage, the next first. */
        pendingPlayerIds: Type.Array(Id, { uniqueItems: true }),
        /** The minors' stations the public company keeps, once chosen. */
        stationIds: Type.Optional(Type.Array(Id, { uniqueItems: true })),
        /** The shares each player holds once the company forms: one a minor, and those bought. */
        allotments: Type.Array(ShareAllotment1861)
    },
    { additionalProperties: false }
)
export type MergerProposal1861 = Type.Static<typeof MergerProposal1861>

/** The merger round after an operating round in phases 3 to 7 (§12). */
export const MergerRound1861 = Type.Object(
    {
        set: Type.Integer({ minimum: 1 }),
        round: Type.Integer({ minimum: 1 }),
        /** The minors still to be offered to their owners, in operating order. */
        minorIds: Type.Array(Id, { uniqueItems: true }),
        proposal: Type.Optional(MergerProposal1861),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type MergerRound1861 = Type.Static<typeof MergerRound1861>

export const MergerRoundState1861 = 'MergerRound'
export const MergerRoundStates1861 = [MergerRoundState1861] as const

export function validateMergerRound1861(state: {
    machineState: string
    mergerRound?: MergerRound1861
}): void {
    const round = state.mergerRound
    const active = !!round && !round.completed
    assert(
        active === (state.machineState === MergerRoundState1861),
        'A merger round in progress belongs to its own state'
    )
    if (round?.proposal)
        assert(
            round.proposal.minorIds.includes(round.proposal.minorId),
            'A proposal includes the minor whose turn it is'
        )
}
