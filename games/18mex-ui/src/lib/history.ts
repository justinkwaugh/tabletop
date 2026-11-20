import {
    isChooseExchangeStation,
    isCloseMinors,
    isCollectMail,
    isDeclineNdmMerger,
    isMergeIntoNdm,
    NdmId,
    phaseChangesMex,
    type MergerOutcome,
    type MinorClosure
} from '@tabletop/18mex'
import {
    ownerName,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat,
    type TitleHistoryNames
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

export type HistoryNamesMex = HistoryNames & Pick<TitleHistoryNames, 'place'>

/** A minor's closing: its owner's trade-in share and the money its major took (5.2). */
function closureLine(closure: MinorClosure, names: HistoryNamesMex, money: MoneyFormat): string {
    // The NdM's trade-in certificates are its 5% units (5.2).
    const share = closure.majorId === NdmId ? '5%' : '10%'
    return [
        `${names.companyName(closure.minorId)} closed: ${names.playerName(closure.playerId)} received a ${share} ${names.companyName(closure.majorId)} share`,
        ...(closure.payment
            ? [`${names.companyName(closure.majorId)} took its ${money(closure.payment.amount)}`]
            : [])
    ].join('; ')
}

/** What the NdM merger did, a line for each consequence (5.3). */
function mergerLines(outcome: MergerOutcome, names: HistoryNamesMex, money: MoneyFormat): string[] {
    if (outcome.noMerger)
        return [
            'No company merged into the NdM: its trade-in 10% went on sale and every certificate limit rose by one'
        ]
    if (outcome.exchangedLocationId)
        return [
            `The NdM’s exchange token replaced the station in ${names.place(outcome.exchangedLocationId)}`
        ]
    const merged = outcome.merged
    if (!merged) return []
    return [
        `${names.companyName(merged.companyId)} merged into the NdM`,
        ...(merged.presidentPlayerId
            ? [
                  `${names.playerName(merged.presidentPlayerId)} exchanged its president’s certificate for the NdM’s trade-in 10%`
              ]
            : []),
        ...merged.compensation.map(
            (payment) =>
                `${ownerName(payment.to, names)} was paid ${money(payment.amount)} for its shares`
        ),
        ...(merged.exchangedLocationIds.length
            ? [
                  `NdM exchange tokens in ${merged.exchangedLocationIds.map(names.place).join(' and ')}`
              ]
            : []),
        ...(merged.treasury ? [`The NdM took its ${money(merged.treasury.amount)}`] : []),
        ...(merged.trainIds.length
            ? [
                  `The NdM took its ${merged.trainIds.length === 1 ? 'train' : `${merged.trainIds.length} trains`}`
              ]
            : [])
    ]
}

/** The history rows of 18MEX's own actions, from their input and metadata. */
export function describeMexAction(
    action: GameAction,
    names: HistoryNamesMex,
    money: MoneyFormat,
    shared: () => HistoryDescription
): HistoryDescription | undefined {
    const { companyName } = names
    if (isCollectMail(action))
        return {
            text: `${companyName(action.companyId)} collected its mail contract`,
            value: action.metadata?.payment ? money(action.metadata.payment.amount) : undefined,
            routine: true
        }
    if (isCloseMinors(action))
        return {
            text: 'The minor companies closed',
            omitActor: true,
            important: true,
            detailLines: (action.metadata?.closures ?? []).map((closure) =>
                closureLine(closure, names, money)
            )
        }
    if (isMergeIntoNdm(action))
        return {
            text: `Merged ${companyName(action.companyId)} into the NdM`,
            important: true,
            detailLines: action.metadata ? mergerLines(action.metadata, names, money) : []
        }
    if (isDeclineNdmMerger(action))
        return {
            text: 'Declined to merge a company into the NdM',
            detailLines: action.metadata ? mergerLines(action.metadata, names, money) : []
        }
    if (isChooseExchangeStation(action))
        return {
            text: `Placed the NdM’s exchange token in ${names.place(action.locationId)}`
        }
    const changes = phaseChangesMex(action)
    if (!changes) return undefined
    const lines = [
        ...(changes.minorClosures ?? []).map((closure) => closureLine(closure, names, money)),
        ...(changes.minorsClosing
            ? ['The minor companies close as the next stock round starts']
            : []),
        ...(changes.merger ? mergerLines(changes.merger, names, money) : [])
    ]
    if (!lines.length) return undefined
    const base = shared()
    return { ...base, detailLines: [...(base.detailLines ?? []), ...lines] }
}
