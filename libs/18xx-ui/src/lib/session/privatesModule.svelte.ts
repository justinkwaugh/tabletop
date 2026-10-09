import { assert, assertExists } from '@tabletop/common'
import {
    ExchangePrivate,
    ExchangePrivateOutOfTurn,
    evaluatePrivateExchange,
    getCompany,
    hasPrivatePowerRequest,
    isDropPrivatePowerRequest,
    isSetPrivatePowerRequest,
    requestablePrivateIds,
    SetPrivatePowerRequest,
    type PrivatePowerRequestDropReason,
    outOfTurnExchangeOffers,
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
    Parameters<typeof nextCompanyToFloat>[0] &
    Parameters<typeof requestablePrivateIds>[0]

export type PrivatesSession = ModuleSession<
    PrivatesState,
    Pick<
        EighteenXXTitleRules,
        | 'privateRules'
        | 'stockRules'
        | 'companyRules'
        | 'outOfTurnPrivatePowers'
        | 'privatePowerRules'
        | 'names'
    >
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
    hasExchanges = $derived.by(() => {
        const { state, rules } = this.session
        return state.companies.some(
            (company) =>
                company.kind === 'private' &&
                !company.closed &&
                rules.privateRules.exchangeTerms(state, company.id) !== undefined
        )
    })
    private exchangesBlocked = $derived.by(() => {
        const { state, rules } = this.session
        return (
            !this.session.interactive ||
            pendingCompanyDecision(state) ||
            !!nextCompanyToFloat(state, rules.companyRules)
        )
    })
    exchangeOffers = $derived.by(() => {
        const { state, rules } = this.session
        if (this.exchangesBlocked) return []
        return this.session.actingPlayerIds
            .filter((playerId) => state.activePlayerIds.includes(playerId))
            .flatMap((playerId) =>
                privateExchangeOffers(state, playerId, rules.privateRules, rules.stockRules)
            )
    })
    outOfTurnExchangeOffers = $derived.by(() => {
        const { state, rules } = this.session
        if (this.exchangesBlocked || !rules.outOfTurnPrivatePowers) return []
        return state.players
            .filter(({ playerId }) => this.session.canActFor(playerId))
            .flatMap(({ playerId }) =>
                outOfTurnExchangeOffers(state, playerId, rules.privateRules, rules.stockRules)
            )
    })
    exchangeOptions = $derived(this.distinctOffers(this.exchangeOffers))
    outOfTurnExchangeOptions = $derived(this.distinctOffers(this.outOfTurnExchangeOffers))
    allExchangeOptions = $derived([...this.exchangeOptions, ...this.outOfTurnExchangeOptions])
    exchangeSelection = $derived.by(() => {
        const chosen = this.exchangeChoice.value('choice')
        return this.session.selectionsVisible && chosen && this.isOffered(chosen)
            ? chosen
            : undefined
    })

    requestPlayers = $derived.by(() => {
        const { state, rules } = this.session
        if (!this.session.interactive) return []
        return state.players
            .map((player) => player.playerId)
            .filter(
                (playerId) =>
                    this.session.canActFor(playerId) &&
                    (hasPrivatePowerRequest(state, playerId) ||
                        requestablePrivateIds(state, playerId, rules.privatePowerRules).length > 0)
            )
    })
    requestablePrivateNames(playerId: string) {
        const { state, rules } = this.session
        return requestablePrivateIds(state, playerId, rules.privatePowerRules).map((id) =>
            rules.names.company(id)
        )
    }
    hasRequest(playerId: string) {
        return hasPrivatePowerRequest(this.session.state, playerId)
    }
    lastRequestDrop(playerId: string): PrivatePowerRequestDropReason | undefined {
        const last = this.session.recordedActions.findLast(
            (action) =>
                (isSetPrivatePowerRequest(action) && action.playerId === playerId) ||
                (isDropPrivatePowerRequest(action) && action.requesterId === playerId)
        )
        return last && isDropPrivatePowerRequest(last) ? last.reason : undefined
    }
    async setRequest(playerId: string, requested: boolean) {
        assert(this.requestPlayers.includes(playerId), 'This player cannot request a pause')
        const action = this.session.createPlayerAction(SetPrivatePowerRequest, {
            outOfTurn: true,
            supersedable: true,
            requested
        })
        action.playerId = playerId
        await this.session.applyAction(this.session.withSupersededAction(action))
    }
    exchangeCompany(certificateId: string) {
        const certificate = this.session.state.certificates.find(
            (item) => item.id === certificateId
        )
        assertExists(certificate, 'An exchange requires its destination certificate')
        return getCompany(this.session.state, certificate.companyId)
    }
    async exchange(request: PrivateExchangeRequest) {
        this.selectExchange(request)
        await this.confirmExchange()
    }
    selectExchange(request: PrivateExchangeRequest) {
        assert(this.isOffered(request), 'Choose an available private exchange')
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
        const exchange = {
            privateCompanyId: request.privateCompanyId,
            certificateId: request.certificateId
        }
        const action = state.activePlayerIds.includes(request.playerId)
            ? this.session.createPlayerAction(ExchangePrivate, exchange)
            : this.session.createPlayerAction(ExchangePrivateOutOfTurn, {
                  ...exchange,
                  outOfTurn: true,
                  sequenced: true
              })
        action.playerId = request.playerId
        await this.session.applyAction(action)
    }

    private isOffered(request: PrivateExchangeRequest) {
        return [...this.exchangeOffers, ...this.outOfTurnExchangeOffers].some((offer) =>
            sameExchange(offer, request)
        )
    }
    private distinctOffers(offers: readonly PrivateExchangeRequest[]) {
        const seen = new Set<string>()
        return offers.filter((offer) => {
            const certificate = this.session.state.certificates.find(
                (item) => item.id === offer.certificateId
            )
            assert(
                certificate && certificate.kind === 'share',
                'An exchange offer requires an available share certificate'
            )
            const key = JSON.stringify([
                offer.playerId,
                offer.privateCompanyId,
                certificate.companyId,
                certificate.owner,
                certificate.poolId,
                certificate.shares,
                certificate.president,
                certificate.number
            ])
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }
}
