import { assert } from '@tabletop/common'
import {
    ExchangePrivate,
    evaluatePrivateExchange,
    nextCompanyToFloat,
    pendingCompanyDecision,
    privateExchangeOffers,
    type EighteenXXTitleRules,
    type PrivateExchangeRequest
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

type PrivatesState = Parameters<typeof privateExchangeOffers>[0] &
    Parameters<typeof pendingCompanyDecision>[0] &
    Parameters<typeof nextCompanyToFloat>[0]

export type PrivatesSession = ModuleSession<
    PrivatesState,
    Pick<EighteenXXTitleRules, 'privateRules' | 'stockRules' | 'companyRules'>
>

function sameExchange(a: PrivateExchangeRequest, b: PrivateExchangeRequest) {
    return (
        a.playerId === b.playerId &&
        a.privateCompanyId === b.privateCompanyId &&
        a.certificateId === b.certificateId
    )
}

export class PrivatesModule {
    readonly exchangeChoice = singleChoice<PrivateExchangeRequest>()
    constructor(private readonly session: PrivatesSession) {}

    companies = $derived.by(() =>
        this.session.state.companies
            .filter((company) => company.kind === 'private')
            .map((company) => ({
                ...company,
                description: this.session.rules.privateRules.description(
                    this.session.state,
                    company.id
                )
            }))
    )
    exchangeOffers = $derived.by(() => {
        const { state, rules } = this.session
        if (
            !this.session.interactive ||
            pendingCompanyDecision(state) ||
            nextCompanyToFloat(state, rules.companyRules)
        )
            return []
        return this.session.actingPlayerIds.flatMap((playerId) =>
            privateExchangeOffers(state, playerId, rules.privateRules, rules.stockRules)
        )
    })
    exchangeSelection = $derived.by(() => {
        const draft = this.exchangeChoice.value('choice')
        return this.session.selectionsVisible &&
            draft &&
            this.exchangeOffers.some((offer) => sameExchange(offer, draft))
            ? draft
            : undefined
    })

    selectExchange(request: PrivateExchangeRequest) {
        assert(
            this.exchangeOffers.some((offer) => sameExchange(offer, request)),
            'Choose an available private exchange'
        )
        this.exchangeChoice.choose('choice', request)
    }
    async confirmExchange() {
        const request = this.exchangeSelection
        assert(request, 'Choose an available private exchange')
        assert(
            this.session.canActFor(request.playerId),
            'Only the owning player can confirm this exchange'
        )
        const { state, rules } = this.session
        assert(
            evaluatePrivateExchange(state, request, rules.privateRules, rules.stockRules).details,
            'This private exchange is unavailable'
        )
        const action = this.session.createPlayerAction(ExchangePrivate, {
            privateCompanyId: request.privateCompanyId,
            certificateId: request.certificateId
        })
        action.playerId = request.playerId
        await this.session.applyAction(action)
    }
}
