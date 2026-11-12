import { holdsAccessRight, type AccessRightRules, type AccessRightState } from '@tabletop/18xx'
import { requireState1849 } from './state.js'
import { ElectricTrainCount, ElectricTrainId, Phases1849 } from './trains.js'

/** The E token a corporation must hold to buy E trains (§14.3). */
export const ETokenId = 'e-token'
/** E tokens and E trains come with the first 12H (§14.3). */
export const ElectricPhaseId1849 = '12H'
/** E tokens cost less from phase 16 (§14.3). */
export const CheaperETokenPhaseId1849 = '16H'
/** Catania, Messina, Palermo and Siracusa pay double to an E train (§14.3). */
export const ElectricDoubledLocationIds1849: readonly string[] = ['H12', 'B14', 'C5', 'M13']

export function electricDreamsInPlay(state: object): boolean {
    return requireState1849(state).variants.electricDreams === true
}

/** The first E token sold costs more than the five after it, and all cost less in phase 16. */
export function eTokenPrice1849(state: { phaseId: string } & AccessRightState): number {
    const sold = (state.accessRights ?? []).some((right) => right.rightId === ETokenId)
    const late = Phases1849.isAtLeast(state.phaseId, CheaperETokenPhaseId1849)
    return sold ? (late ? 550 : 800) : late ? 800 : 1100
}

/**
 * The Electric Dreams variant's E tokens (§14.3): six, one a corporation, bought from the bank
 * immediately before buying trains, so never in the turn the first 12H is bought.
 */
export const AccessRightRules1849: AccessRightRules = {
    rights: [{ id: ETokenId, name: 'E token', supply: ElectricTrainCount }],
    purchaseTerms(state, companyId) {
        if (!electricDreamsInPlay(state)) return { reason: 'E tokens are not in this game.' }
        const title = requireState1849(state)
        if (!Phases1849.isAtLeast(title.phaseId, ElectricPhaseId1849))
            return { reason: 'E tokens come with the first 12H.' }
        if (
            title.machineState !== 'BuyingTrains' ||
            title.trainPurchaseStep?.companyId !== companyId ||
            title.trainPurchaseStep.purchasedTrainIds.length
        )
            return { reason: 'An E token is bought before the turn’s trains.' }
        return { price: eTokenPrice1849(title) }
    }
}

/** Why the corporation may not buy an E train, if it may not: it needs an E token (§14.3). */
export function electricTrainReason1849(
    state: object,
    companyId: string,
    definitionId: string
): string | undefined {
    return definitionId === ElectricTrainId &&
        !holdsAccessRight(requireState1849(state), companyId, ETokenId)
        ? 'An E train needs an E token.'
        : undefined
}
