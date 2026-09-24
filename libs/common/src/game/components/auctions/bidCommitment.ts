import * as Type from 'typebox'

export const BidCommitment = Type.Object(
    {
        lotId: Type.String({ minLength: 1 }),
        playerId: Type.String({ minLength: 1 }),
        amount: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type BidCommitment = Type.Static<typeof BidCommitment>

export function committedBidAmount(
    bids: readonly BidCommitment[],
    playerId: string,
    exceptLotId?: string
): number {
    return bids.reduce(
        (sum, bid) =>
            sum + (bid.playerId === playerId && bid.lotId !== exceptLotId ? bid.amount : 0),
        0
    )
}
export function availableBidAmount(
    cash: number,
    bids: readonly BidCommitment[],
    playerId: string,
    lotId?: string
): number {
    return cash - committedBidAmount(bids, playerId, lotId)
}
