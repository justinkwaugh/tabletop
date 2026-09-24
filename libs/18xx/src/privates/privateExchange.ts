import { isOperatingStep } from '../operating/operatingSteps.js'
import { allPlayersPassed } from '../stock/stockRoundRules.js'
import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    copyFinances,
    getCompany,
    privateOwner,
    sameOwner,
    sharesOwned,
    type Owner
} from '../finance/finance.js'
import { exchangeCertificate } from '../finance/certificateExchange.js'
import { grantOwnershipLimitExemption } from '../company/companyState.js'
import { PresidencyChange, evaluatePresidency, applyPresidencyChange } from '../stock/presidency.js'
import type { StockRules } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
import { closePrivate } from './privateCompany.js'
import type { PrivateRules, PrivateState } from './privateRules.js'

export type PrivateExchangeRequest = {
    playerId: string
    privateCompanyId: string
    certificateId: string
}
export const PrivateExchangeDetails = Type.Object(
    {
        privateCompanyId: Type.String(),
        certificateId: Type.String(),
        companyId: Type.String(),
        exemptOwnershipLimit: Type.Boolean(),
        stockAction: Type.Union([Type.Literal('additional'), Type.Literal('none')]),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type PrivateExchangeDetails = Type.Static<typeof PrivateExchangeDetails>
export type PrivateExchangeResult =
    | { details: PrivateExchangeDetails; reason?: never }
    | { details?: never; reason: string }

export function evaluatePrivateExchange(
    state: PrivateState,
    request: PrivateExchangeRequest,
    rules: PrivateRules,
    stockRules: StockRules
): PrivateExchangeResult {
    const company = state.companies.find((item) => item.id === request.privateCompanyId)
    if (!company || company.kind !== 'private' || company.closed)
        return { reason: 'This private is closed or unavailable.' }
    const owner = privateOwner(state, company.id)
    if (!owner || owner.kind !== 'player' || owner.playerId !== request.playerId)
        return { reason: 'Only the owning player may exchange this private.' }
    const terms = rules.exchangeTerms(state, company.id)
    if (!terms || !terms.certificateIds.includes(request.certificateId))
        return { reason: 'This share is not available for this private exchange.' }
    if (state.machineState !== 'StockRound' && !isOperatingStep(state.machineState))
        return { reason: 'Resolve the current obligation before exchanging.' }
    if (
        state.machineState === 'StockRound' &&
        (state.stockRound.completed || allPlayersPassed(state))
    )
        return { reason: 'The stock round has completed.' }
    if (
        terms.timing === 'own-stock-turn' &&
        (state.machineState !== 'StockRound' || state.activePlayerIds[0] !== request.playerId)
    )
        return { reason: 'Exchange during your own stock turn.' }
    const certificate = state.certificates.find((item) => item.id === request.certificateId)
    if (
        !certificate ||
        certificate.retired ||
        certificate.kind !== 'share' ||
        sameOwner(certificate.owner, owner)
    )
        return { reason: 'This share is unavailable.' }
    const target = getCompany(state, certificate.companyId)
    if (target.closed) return { reason: 'The railway is closed.' }
    assertExists(target.shareCount, 'Exchange shares require a share count')
    if (
        terms.ownershipLimit === 'ordinary' &&
        (sharesOwned(state, target.id, owner) + certificate.shares) * 100 >
            stockRules.ownershipLimit(state, target.id, owner) * target.shareCount
    )
        return { reason: 'The exchange exceeds the ownership limit.' }
    const projected: StockState = {
        ...state,
        ...copyFinances(state),
        ownershipLimitExemptions: structuredClone(state.ownershipLimitExemptions)
    }
    const presidency = applyPrivateShareExchange(
        projected,
        company.id,
        certificate.id,
        terms.ownershipLimit === 'exempt',
        stockRules
    )
    return {
        details: {
            privateCompanyId: request.privateCompanyId,
            certificateId: request.certificateId,
            companyId: target.id,
            exemptOwnershipLimit: terms.ownershipLimit === 'exempt',
            stockAction: terms.stockAction,
            ...(presidency ? { presidency } : {})
        }
    }
}

export function privateExchangeOffers(
    state: PrivateState,
    playerId: string,
    rules: PrivateRules,
    stockRules: StockRules
): PrivateExchangeRequest[] {
    return state.companies
        .filter((company) => company.kind === 'private' && !company.closed)
        .flatMap((company) =>
            (rules.exchangeTerms(state, company.id)?.certificateIds ?? []).map((certificateId) => ({
                playerId,
                privateCompanyId: company.id,
                certificateId
            }))
        )
        .filter((request) => evaluatePrivateExchange(state, request, rules, stockRules).details)
}

export function applyPrivateShareExchange(
    state: StockState,
    privateCompanyId: string,
    certificateId: string,
    exemptOwnershipLimit: boolean,
    rules: StockRules
): PresidencyChange | undefined {
    const surrendered = state.certificates.find(
        (item) => !item.retired && item.kind === 'private' && item.companyId === privateCompanyId
    )
    const received = state.certificates.find((item) => item.id === certificateId)
    assert(
        surrendered && received && !received.retired && received.kind === 'share',
        'Private exchange requires both certificates'
    )
    const owner: Owner = exchangeCertificate(state, surrendered.id, received.id)
    closePrivate(state, privateCompanyId)
    if (exemptOwnershipLimit) grantOwnershipLimitExemption(state, received.companyId, owner)
    if (!getCompany(state, received.companyId).president) return undefined
    const presidency = evaluatePresidency(
        state,
        received.companyId,
        rules.presidencyCandidates(state, received.companyId)
    )
    assert(!presidency.reason, presidency.reason ?? 'Invalid exchange presidency')
    if (presidency.change) applyPresidencyChange(state, presidency.change)
    return presidency.change
}
