import type { SharePurchaseDetails } from '@tabletop/18xx'

export function playerPurchaseContribution(
    details: SharePurchaseDetails,
    playerId: string | undefined
): number {
    return details.payments.reduce(
        (total, payment) =>
            payment.from.kind === 'player' && payment.from.playerId === playerId
                ? total + payment.amount
                : total,
        0
    )
}
