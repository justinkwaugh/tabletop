import type { GameAction, GameState } from '@tabletop/common'
import {
    isOfferPurchase,
    isRespondToPurchaseOffer,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { TitleOperatingStep } from '../session/titlePresentation.js'
import type { OperatingStepStatuses } from './operatingStepStatuses.js'

const indices: Readonly<Record<string, number>> = {
    LayingTrack: 0,
    PlacingStation: 1,
    RunningTrains: 2,
    RustingTrains: 2,
    DistributingEarnings: 3,
    BuyingTrains: 4,
    FundingTrain: 4,
    RepayingLoans: 5,
    RaisingCash: 5
}

export function operatingStepIndex(machineState: string): number | undefined {
    return indices[machineState]
}

const actionIndices: Readonly<Record<string, number>> = {
    LayTile: 0,
    RequestTrackConsent: 0,
    RespondToTrackConsent: 0,
    FinishTrack: 0,
    PlaceStation: 1,
    FinishStations: 1,
    RunTrains: 2,
    DistributeEarnings: 3,
    BuyTrain: 4,
    BuyPrivateTrain: 4,
    FundTrain: 4,
    ContributeTrainFunds: 4,
    SellFundingShares: 4,
    FinishTrains: 4,
    PayInterest: 5,
    RepayLoan: 5,
    SellSharesToPay: 5,
    GoBankrupt: 5
}

export function historicalOperatingStepIndex(
    action: GameAction | undefined,
    machineState: string
): number | undefined {
    if (action) {
        if (
            (isOfferPurchase(action) || isRespondToPurchaseOffer(action)) &&
            action.metadata?.offer.asset.kind === 'train'
        )
            return 4
        const index = actionIndices[action.type]
        if (index !== undefined) return index
    }
    return operatingStepIndex(machineState)
}

type ConstructionLayoutStep = 'build' | 'run' | 'payout' | 'trains' | 'loans'

/**
 * The operating steps of a title that places stations in its track step: track, stations and
 * share issues are one Build step.
 */
export function constructionOperatingSteps<State extends GameState>(
    rules: Pick<EighteenXXTitleRules, 'additionalConstructionActions' | 'loanRules'>,
    titleActions: Partial<Record<ConstructionLayoutStep, readonly string[]>> = {}
): TitleOperatingStep<State>[] {
    const step = (
        id: ConstructionLayoutStep,
        label: string,
        states: readonly string[],
        status: (summaries: OperatingStepStatuses) => string | undefined,
        indices: readonly number[],
        familyActions: readonly string[] = []
    ): TitleOperatingStep<State> => ({
        label,
        states,
        actions: [
            ...Object.keys(actionIndices).filter((type) => indices.includes(actionIndices[type])),
            ...familyActions,
            ...(titleActions[id] ?? [])
        ],
        status: (_state, _actions, summaries) => status(summaries)
    })
    const build = (summaries: OperatingStepStatuses) =>
        [summaries.finance, summaries.track, summaries.station].filter(Boolean).join(' · ') ||
        undefined
    return [
        step(
            'build',
            'Build',
            ['LayingTrack'],
            build,
            [0, 1],
            ['CorporateFinance', ...(rules.additionalConstructionActions ?? [])]
        ),
        step('run', 'Run', ['RunningTrains', 'RustingTrains'], (summaries) => summaries.run, [2]),
        step('payout', 'Payout', ['DistributingEarnings'], (summaries) => summaries.payout, [3]),
        step(
            'trains',
            'Trains',
            ['BuyingTrains', 'FundingTrain', 'DiscardingTrains'],
            (summaries) => summaries.trains,
            [4]
        ),
        ...(rules.loanRules
            ? [
                  step(
                      'loans',
                      'Loans',
                      ['RepayingLoans', 'RaisingCash'],
                      (summaries) => summaries.loans,
                      [5]
                  )
              ]
            : [])
    ]
}
