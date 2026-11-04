import * as Type from 'typebox'
import { Owner } from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })

export const TakeoverRecord = Type.Object(
    { acquirerId: Id, targetId: Id },
    { additionalProperties: false }
)
export type TakeoverRecord = Type.Static<typeof TakeoverRecord>

/** Target shares a holder gives up for the acquirer's unissued shares, one for one (§11.5). */
export const ShareSwap = Type.Object(
    { holder: Owner, shares: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type ShareSwap = Type.Static<typeof ShareSwap>

export const TakeoverOffer = Type.Object(
    { companyId: Id, targetId: Id, swaps: Type.Array(ShareSwap) },
    { additionalProperties: false }
)
export type TakeoverOffer = Type.Static<typeof TakeoverOffer>

/** The takeover step under way; it leaves State when the step ends. */
export const TakeoverStep = Type.Object(
    {
        /** The corporations still to attempt a takeover, in stock price order. */
        companyIds: Type.Array(Id, { uniqueItems: true }),
        offer: Type.Optional(TakeoverOffer),
        /** An acquirer over its train limit, turning trains in. */
        discardCompanyId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type TakeoverStep = Type.Static<typeof TakeoverStep>

export const TakingOverState = 'TakingOver'

export const TakeoverFields1833NE = {
    takeoverGame: Type.Optional(Type.Literal(true)),
    takeovers: Type.Optional(Type.Array(TakeoverRecord)),
    takeoverStep: Type.Optional(TakeoverStep),
    /** The operating set whose takeover step has been held. */
    takeoverSet: Type.Optional(Type.Integer({ minimum: 1 }))
}
export type TakeoverState = Type.Static<Type.TObject<typeof TakeoverFields1833NE>>

function hasTakeovers(state: object): state is TakeoverState {
    return 'takeovers' in state
}

/** The takeovers so far, from any 1833NE state, as family hooks receive it. */
export function recordedTakeovers(state: object): readonly TakeoverRecord[] {
    return hasTakeovers(state) ? (state.takeovers ?? []) : []
}

/** How many takeovers a corporation has done itself, each raising its train limit (§6.83). */
export function takeoversBy(state: TakeoverState, companyId: string): number {
    return (state.takeovers ?? []).filter((takeover) => takeover.acquirerId === companyId).length
}

/**
 * The corporation holding a taken-over corporation's reserved spaces, discounts and share of
 * the joint token (§11.7), following takeovers of takeovers.
 */
export function successorOf(state: object, companyId: string): string {
    let current = companyId
    for (const takeover of recordedTakeovers(state))
        if (takeover.targetId === current) current = takeover.acquirerId
    return current
}

/** Whether a corporation holds a right that belonged to ``original`` (§11.7). */
export function holdsRightsOf(state: object, companyId: string, original: string): boolean {
    return successorOf(state, original) === companyId
}
