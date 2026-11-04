import { isDiscardMergedTrain } from '@tabletop/18xx'
import {
    isAnswerMerger,
    isCompleteMergerPhase,
    isCompleteTakeover,
    isPassMerger,
    isProposeMerger,
    isSellTakeoverShares,
    isStartMergerPhase,
    type MergerOutcome,
    isBuyCoalRights,
    isCapitalizeCompany,
    isCloseCompany,
    type CloseCompany,
    isPlaceRevenueToken,
    isRecordMiamiRun,
    isTakeLondonShare,
    EighteenThirtyTwoMarket
} from '@tabletop/1832'
import { assertExists, type GameAction } from '@tabletop/common'
import type {
    HistoryDescription,
    HistoryMapPlacement,
    HistoryNames,
    MoneyFormat,
    TitleHistoryNames
} from '@tabletop/18xx-ui'
import {
    companyClosureDetails,
    describeShareAction,
    ownerName,
    stopRightsBoughtRow
} from '@tabletop/18xx-ui'

const TokenNames = { port: 'Port', cotton: 'Cotton', 'key-west': 'Key West' } as const

/** 1832's revenue tokens, for their history rows' map previews. */
export function eighteenThirtyTwoMapPlacement(action: GameAction): HistoryMapPlacement | undefined {
    if (isPlaceRevenueToken(action))
        return {
            kind: `${TokenNames[action.kind]} token`,
            companyId: action.companyId,
            locationIds: [action.locationId]
        }
    return undefined
}

/** 1832 adds its revenue and coal tokens and a funding president's lost cash to a closure. */
function closureDetail(
    closure: NonNullable<CloseCompany['metadata']>,
    names: HistoryNames,
    money: MoneyFormat
): string {
    return [
        ...companyClosureDetails(closure, names.companyName),
        ...(closure.removedRevenueTokens ?? []).map(
            (token) => `${TokenNames[token.kind]} token removed`
        ),
        ...(closure.returnedCoalRights ? ['Coal token back to the supply'] : []),
        ...(closure.forfeit
            ? [`${ownerName(closure.forfeit.from, names)} lost ${money(closure.forfeit.amount)}`]
            : [])
    ].join(' · ')
}

/** 1832's own actions, as history rows. */
export function describe1832Action(
    action: GameAction,
    names: HistoryNames & Pick<TitleHistoryNames, 'place'>,
    money: MoneyFormat
): HistoryDescription | undefined {
    const { companyName, place } = names
    const shareAction = describeShareAction(action, names, money, EighteenThirtyTwoMarket)
    if (shareAction) return shareAction
    if (isCapitalizeCompany(action))
        return {
            text: `${companyName(action.companyId)} received its capital`,
            ...(action.metadata ? { value: money(action.metadata.payment.amount) } : {}),
            omitActor: true
        }
    if (isBuyCoalRights(action))
        return stopRightsBoughtRow(
            `${companyName(action.companyId)} bought a West Virginia Coal Fields token`,
            action.metadata,
            money
        )
    if (isPlaceRevenueToken(action))
        return {
            text: `${companyName(action.companyId)} placed the ${TokenNames[action.kind]} token in ${place(action.locationId)}`
        }
    if (isTakeLondonShare(action))
        return {
            text: action.metadata
                ? `took a free ${companyName(action.metadata.companyId)} share with the London Investment Company`
                : 'took a free share with the London Investment Company'
        }
    const merged = (outcome: MergerOutcome): HistoryDescription => {
        const [first, second] = outcome.companyIds.map(companyName)
        if (outcome.kind === 'system')
            return {
                text: `${companyName(outcome.survivorId)} formed from ${first} and ${second}`,
                omitActor: true,
                important: true
            }
        const paid = (outcome.payments ?? [])
            .filter((payment) => payment.from.kind === 'company')
            .reduce((total, payment) => total + payment.amount, 0)
        return {
            text: `${first} took over ${second}`,
            value: money(paid),
            ...(outcome.certificateLimit ? { certificateLimit: outcome.certificateLimit } : {}),
            omitActor: true,
            important: true
        }
    }
    if (isStartMergerPhase(action) || isCompleteMergerPhase(action) || isPassMerger(action))
        return {
            text: isPassMerger(action) ? 'passed on mergers' : 'Merger phase',
            routine: !isPassMerger(action),
            omitActor: !isPassMerger(action)
        }
    if (isProposeMerger(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return merged(outcome)
        const verb =
            action.kind === 'system'
                ? `proposed a System of ${companyName(action.companyId)} and ${companyName(action.partnerId)}`
                : action.yielded
                  ? `offered ${companyName(action.partnerId)} a takeover of ${companyName(action.companyId)}`
                  : `proposed that ${companyName(action.companyId)} take over ${companyName(action.partnerId)}`
        return { text: verb }
    }
    if (isAnswerMerger(action)) {
        const outcome = action.metadata?.outcome
        if (outcome) return merged(outcome)
        return { text: action.accept ? 'agreed to the merger' : 'refused the merger' }
    }
    if (isCompleteTakeover(action) && action.metadata) return merged(action.metadata)
    if (isSellTakeoverShares(action))
        return {
            text: `sold ${action.shares} ${companyName(action.companyId)} to fund a takeover`,
            ...(action.metadata ? { value: money(action.metadata.proceeds) } : {})
        }
    if (isDiscardMergedTrain(action)) return { text: 'discarded a train after the takeover' }
    if (isCloseCompany(action)) {
        assertExists(action.metadata, 'A recorded closure carries its effects')
        const detail = closureDetail(action.metadata, names, money)
        return {
            text: `${companyName(action.companyId)} closed`,
            companyToken: action.companyId,
            consequence: true,
            ...(detail ? { detail } : {}),
            ...(action.metadata.certificateLimit
                ? { certificateLimit: action.metadata.certificateLimit }
                : {}),
            omitActor: true,
            important: true
        }
    }
    if (isRecordMiamiRun(action))
        return {
            text: 'Miami has been run to; it now pays its value',
            omitActor: true,
            routine: true
        }
    return undefined
}
