import {
    AssignSteamboatValidator,
    SettleIndependentValidator,
    facePrice,
    isAssignRevenueMarker,
    isBuildPrivateTrack,
    isBuyOpeningCompany,
    isChooseDraftCard,
    isPassFinalCompany,
    isPassOpeningPurchase,
    isPlaceCWIStation,
    isRevealDraft,
    type FinalCompanyPass,
    type Selection
} from '@tabletop/1846'
import type { HistoryDescription, HistoryNames, TitleActionDescription } from '@tabletop/18xx-ui'
import { Presentation1846 } from './presentation.js'

type DraftNames = Pick<HistoryNames, 'companyName' | 'playerName'>

export function describe1846Action(session: {
    getPlayerName(playerId: string): string
}): TitleActionDescription {
    const money = Presentation1846.money
    const playerName = (playerId: string) => session.getPlayerName(playerId)

    function reducedPrice(selection: Selection): string | undefined {
        const face = facePrice(selection.cardId)
        return selection.price < face ? `reduced from ${money(face)}` : undefined
    }

    function finalCompanyPassed(
        { reducedOffer, purchase }: FinalCompanyPass,
        names: DraftNames
    ): HistoryDescription {
        return {
            text: `passed ${names.companyName(reducedOffer.cardId)}; its price fell to ${money(reducedOffer.price)}`,
            detail: purchase
                ? `${names.playerName(purchase.playerId)} had to take it for ${money(purchase.price)}`
                : undefined
        }
    }

    return (action, { companyName, place }) => {
        const names = { companyName, playerName }
        // A draft row never names a protected card; only the public final company is named.
        if (isChooseDraftCard(action)) {
            const finalCompany = action.metadata?.finalCompany
            return finalCompany
                ? {
                      text: `took the final company, ${companyName(finalCompany.cardId)}`,
                      value: money(finalCompany.price),
                      detail: reducedPrice(finalCompany)
                  }
                : { text: 'chose a private draft card' }
        }
        if (isPassFinalCompany(action))
            return action.metadata
                ? finalCompanyPassed(action.metadata, names)
                : { text: 'passed the final company; reduce its price by $10' }
        if (isBuyOpeningCompany(action))
            return {
                text: `bought ${companyName(action.companyId)}`,
                value: money(action.expectedPrice),
                detail: reducedPrice({ cardId: action.companyId, price: action.expectedPrice })
            }
        if (isPassOpeningPurchase(action)) {
            const reducedOffer = action.metadata?.reducedOffer
            return reducedOffer
                ? finalCompanyPassed({ reducedOffer, purchase: action.metadata?.purchase }, names)
                : { text: 'passed on opening companies' }
        }
        if (isRevealDraft(action))
            return {
                text: 'Private companies revealed and paid for',
                omitActor: true,
                important: true,
                detailLines: (action.metadata?.purchases ?? []).flatMap((purchase) => {
                    const reduced = reducedPrice(purchase)
                    return reduced
                        ? [
                              `${companyName(purchase.cardId)} went for ${money(purchase.price)}, ${reduced}`
                          ]
                        : []
                })
            }
        if (action.type === 'ResumeOpeningPurchases')
            return { text: 'Opening purchases resume', omitActor: true }
        if (AssignSteamboatValidator.Check(action))
            return {
                text: action.assignment
                    ? `assigned Steamboat to ${companyName(action.assignment.companyId)} at ${place(action.assignment.locationId)}`
                    : 'left Steamboat unassigned'
            }
        if (isBuildPrivateTrack(action))
            return {
                text: `${companyName(action.privateCompanyId)} built private track`,
                detail: action.metadata?.lays
                    .map((lay) => `${place(lay.locationId)} · ${money(lay.cost)}`)
                    .join(', ')
            }
        if (isPlaceCWIStation(action))
            return { text: `${companyName(action.companyId)} placed its C&WI station in Chicago` }
        if (isAssignRevenueMarker(action))
            return {
                text: action.locationId
                    ? `placed ${companyName(action.privateCompanyId)} at ${place(action.locationId)}`
                    : `skipped ${companyName(action.privateCompanyId)} marker placement`
            }
        if (SettleIndependentValidator.Check(action))
            return {
                text: `${companyName(action.companyId)} split its earnings equally between owner and treasury`,
                omitActor: true
            }
        return undefined
    }
}
