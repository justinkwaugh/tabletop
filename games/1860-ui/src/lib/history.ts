import {
    isBeginReturningTrains,
    isBeginSouthernStockRound,
    isFormBritishRail,
    isNationaliseCompanies,
    isBankruptCompany,
    isBidForChoice,
    isBuyPrivateFromBank,
    isChangeInsolvency,
    isChooseCertificate,
    isCompany1860,
    isEndInitialAuction,
    isLayHomeTile,
    isPassForChoice,
    isReturnTrain,
    isSellPrivateToBank,
    isSkipHomeTile,
    TrainDepot1860
} from '@tabletop/1860'
import type { GameAction } from '@tabletop/common'
import type { HistoryDescription, MoneyFormat, TitleHistoryNames } from '@tabletop/18xx-ui'

/** What the history needs of the table beyond the family's names. */
export type HistoryContext1860 = {
    getPlayerName(playerId: string): string
    presentation: { money: MoneyFormat }
}

const list = new Intl.ListFormat('en', { type: 'conjunction' })

/** History rows for 1860's own Actions, from their input and metadata; the family describes the rest. */
export function describe1860Action(
    action: GameAction,
    names: TitleHistoryNames,
    context: HistoryContext1860
): HistoryDescription | undefined {
    const money = context.presentation.money
    const company = names.companyName
    const player = (playerId: string) => context.getPlayerName(playerId)
    if (isBidForChoice(action))
        return { text: 'bid for the right to choose', value: money(action.amount) }
    if (isPassForChoice(action)) return { text: 'passed', routine: true }
    if (isChooseCertificate(action)) {
        const paid = action.metadata ? action.metadata.bid + action.metadata.cost : undefined
        const bid = action.metadata?.bid
        return {
            text:
                isCompany1860(action.lotId) && action.parPrice !== undefined
                    ? `bought ${company(action.lotId)}’s director’s share at par ${money(action.parPrice)}`
                    : `took ${company(action.lotId)}`,
            ...(paid !== undefined ? { value: money(paid) } : {}),
            ...(bid ? { detail: `bid ${money(bid)}` } : {}),
            ...(isCompany1860(action.lotId) ? { companyToken: action.lotId } : {}),
            important: true
        }
    }
    if (isEndInitialAuction(action))
        return {
            text: action.metadata
                ? `The initial auction ended; ${player(action.metadata.priorityPlayerId)} has priority`
                : 'The initial auction ended',
            omitActor: true,
            important: true
        }
    if (isLayHomeTile(action))
        return {
            text: `laid ${company(action.companyId)}’s home tile in ${names.place(action.locationId)}`,
            companyToken: action.companyId
        }
    if (isSkipHomeTile(action))
        return {
            text: `No tile fits ${company(action.companyId)}’s home hex`,
            omitActor: true,
            routine: true
        }
    if (isSellPrivateToBank(action))
        return {
            text: `sold ${company(action.privateCompanyId)} to the bank`,
            ...(action.metadata ? { value: money(action.metadata.proceeds) } : {})
        }
    if (isBuyPrivateFromBank(action)) {
        const closed = action.metadata?.closedPrivateIds ?? []
        return {
            text: `bought ${company(action.privateCompanyId)} from the bank`,
            ...(action.metadata ? { value: money(action.metadata.price) } : {}),
            ...(closed.length
                ? {
                      detailLines: [`${list.format(closed.map(company))} closed`],
                      important: true
                  }
                : {})
        }
    }
    if (isChangeInsolvency(action))
        return {
            text: action.insolvent
                ? `${company(action.companyId)} became insolvent`
                : `${company(action.companyId)} is solvent again`,
            omitActor: true,
            companyToken: action.companyId,
            important: action.insolvent,
            consequence: true
        }
    if (isBankruptCompany(action))
        return {
            text: `${company(action.companyId)} went bankrupt`,
            ...(action.metadata
                ? {
                      detail: `its shares returned to the IPO; ${player(action.metadata.priorityPlayerId)} has priority`
                  }
                : {}),
            omitActor: true,
            companyToken: action.companyId,
            important: true
        }
    if (isBeginReturningTrains(action))
        return {
            text: `${company(action.companyId)} is over its train limit`,
            omitActor: true,
            routine: true,
            consequence: true
        }
    if (isReturnTrain(action)) {
        const train = action.metadata
            ? TrainDepot1860.trainDefinition(action.metadata.definitionId).name
            : 'train'
        return { text: `returned ${company(action.companyId)}’s ${train} to the bank` }
    }
    if (isBeginSouthernStockRound(action))
        return {
            text: 'The Southern Railway’s rule began: no more track, no more bases, and halts pay nothing',
            omitActor: true,
            important: true
        }
    if (isFormBritishRail(action))
        return {
            text: 'British Rail formed: operating rounds follow until every company has closed',
            omitActor: true,
            important: true
        }
    if (isNationaliseCompanies(action)) {
        const closed = action.metadata?.closedCompanyIds ?? []
        return {
            text: closed.length
                ? `British Rail closed ${list.format(closed.map(company))}`
                : 'British Rail closed no company',
            omitActor: true,
            important: true
        }
    }
    return undefined
}
