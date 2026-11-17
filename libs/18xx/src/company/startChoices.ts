import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { presidentCertificate } from '../finance/finance.js'
import type { CompanyRules, StartChoiceContext } from './companyRules.js'
import type { FormationState } from './companyState.js'

/** The president's choices in starting a company, by the title's choice ids. */
export const StartChoices = Type.Record(
    Type.String({ minLength: 1 }),
    Type.String({ minLength: 1 })
)
export type StartChoices = Type.Static<typeof StartChoices>

/** The size of the company's president's certificate as printed, in shares. */
export function printedPresidentShares(state: FormationState, companyId: string): number {
    const certificate = presidentCertificate(state, companyId)
    assertExists(certificate, `${companyId} has no president's certificate`)
    return certificate.shares
}

/** Why the requested president's certificate size or choices cannot start the company. */
export function startChoicesReason(
    state: FormationState,
    rules: CompanyRules,
    companyId: string,
    request: { marketSpaceId: string; presidentShares?: number; choices?: StartChoices }
): string | undefined {
    const printed = printedPresidentShares(state, companyId)
    const presidentShares = request.presidentShares ?? printed
    const sizes = rules.presidentShareSizes?.(state, companyId) ?? [printed]
    if (!sizes.includes(presidentShares)) return 'The president’s certificate cannot be this size.'
    const context: StartChoiceContext = { marketSpaceId: request.marketSpaceId, presidentShares }
    const choices = rules.startChoices?.(state, companyId, context) ?? []
    const given = request.choices ?? {}
    if (Object.keys(given).some((id) => !choices.some((choice) => choice.id === id)))
        return 'This company has no such choice.'
    for (const choice of choices) {
        const option = given[choice.id]
        if (!option) return `Choose the company’s ${choice.label.toLowerCase()}.`
        if (!choice.options.some((entry) => entry.id === option))
            return `This ${choice.label.toLowerCase()} is not available.`
    }
    return undefined
}

/**
 * Makes the company's president's certificate the chosen size, its extra shares taking the
 * place of ordinary certificates that leave the game; returns those certificates' ids.
 */
export function resizePresidentCertificate(
    state: FormationState,
    rules: CompanyRules,
    companyId: string,
    presidentShares: number
): string[] {
    const certificate = presidentCertificate(state, companyId)
    assertExists(certificate, `${companyId} has no president's certificate`)
    const extra = presidentShares - certificate.shares
    if (extra <= 0) return []
    const replaced = (rules.certificatesReplacedByPresident?.(state, companyId) ?? []).slice(
        0,
        extra
    )
    assert(replaced.length === extra, 'Too few certificates to enlarge the president’s')
    certificate.shares = presidentShares
    state.certificates = state.certificates.filter((entry) => !replaced.includes(entry.id))
    return [...replaced]
}

/** The first option of each of the title's start choices at the par and certificate size. */
export function firstStartOptions(
    state: FormationState,
    rules: CompanyRules,
    companyId: string,
    context: StartChoiceContext
): StartChoices {
    return Object.fromEntries(
        (rules.startChoices?.(state, companyId, context) ?? []).flatMap((choice) =>
            choice.options[0] ? [[choice.id, choice.options[0].id]] : []
        )
    )
}

/**
 * The first option of each of the title's start choices at the printed certificate size: a
 * start to test whether the company may start at all at the par.
 */
export function defaultStartChoices(
    state: FormationState,
    rules: CompanyRules,
    companyId: string,
    marketSpaceId: string
): { presidentShares?: number; choices?: StartChoices } {
    const certificate = presidentCertificate(state, companyId)
    if (!certificate || (!rules.presidentShareSizes && !rules.startChoices)) return {}
    const presidentShares = rules.presidentShareSizes?.(state, companyId)[0] ?? certificate.shares
    if (!rules.startChoices) return { presidentShares }
    return {
        presidentShares,
        choices: firstStartOptions(state, rules, companyId, { marketSpaceId, presidentShares })
    }
}
