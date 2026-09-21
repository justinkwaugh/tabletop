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
import type { SessionContext } from './sessionContext.js'
import { singleChoiceStore } from './stagedSelectionStore.svelte.js'

type PrivatesState = Parameters<typeof privateExchangeOffers>[0] &
    Parameters<typeof pendingCompanyDecision>[0] &
    Parameters<typeof nextCompanyToFloat>[0]

export type PrivatesContext = SessionContext<
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
    readonly exchangeChoice = singleChoiceStore<PrivateExchangeRequest>()
    constructor(private readonly context: PrivatesContext) {}

    companies = $derived.by(() =>
        this.context.state.companies
            .filter((company) => company.kind === 'private')
            .map((company) => ({
                ...company,
                description: this.context.rules.privateRules.description(
                    this.context.state,
                    company.id
                )
            }))
    )
    exchangeOffers = $derived.by(() => {
        const { state, rules } = this.context
        if (
            !this.context.interactive ||
            pendingCompanyDecision(state) ||
            nextCompanyToFloat(state, rules.companyRules)
        )
            return []
        return this.context.actingPlayerIds.flatMap((playerId) =>
            privateExchangeOffers(state, playerId, rules.privateRules, rules.stockRules)
        )
    })
    exchangeSelection = $derived.by(() => {
        const draft = this.exchangeChoice.value('choice')
        return this.context.draftsVisible &&
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
            this.context.canActFor(request.playerId),
            'Only the owning player can confirm this exchange'
        )
        const { state, rules } = this.context
        assert(
            evaluatePrivateExchange(state, request, rules.privateRules, rules.stockRules).details,
            'This private exchange is unavailable'
        )
        const action = this.context.createPlayerAction(ExchangePrivate, {
            privateCompanyId: request.privateCompanyId,
            certificateId: request.certificateId
        })
        action.playerId = request.playerId
        await this.context.applyAction(action)
    }
}
