import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    PresidencyChange,
    PresidencyClaim,
    applyShareTransfer,
    evaluateShareAcquisition,
    getCompany,
    markTurnPurchase,
    privateOwner,
    recordStockAction,
    type CompanyRules,
    type PrivateRules,
    type StockState
} from '@tabletop/18xx'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoState,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { EighteenThirtyTwoMajors } from './majors.js'
import { titleStepAction } from './titleActions.js'
import { inGame, type EighteenThirtyTwoTitleState } from './titleState.js'

export const LondonPrivateId = 'P4'
const CentralOfGeorgia = EighteenThirtyTwoMajors.CG.id

/** Records the stock round in which a company's president's certificate was bought. */
export const recordCompanyStart: NonNullable<CompanyRules['onStart']> = (state, details) => {
    requireEighteenThirtyTwoState(state).companyStarts[details.companyId] = state.stockRound.number
}

function startedThisRound(state: StockState & EighteenThirtyTwoTitleState, companyId: string) {
    return (
        state.companyStarts[companyId] === state.stockRound.number ||
        (companyId === CentralOfGeorgia &&
            state.stockRound.number === 1 &&
            getCompany(state, CentralOfGeorgia).started)
    )
}

function londonUsed(state: { usedPrivatePowerIds: readonly string[] }) {
    return state.usedPrivatePowerIds.includes(LondonPrivateId)
}

/**
 * As their stock purchase, the London Investment Company's owner takes a free initial-offering
 * share of a company whose president's certificate was bought this stock round, the CoG's
 * included in the first (§16.2 P4).
 */
export function londonShareChoices(state: EighteenThirtyTwoState, playerId: string): string[] {
    if (!inGame(state, LondonPrivateId)) return []
    const owner = privateOwner(state, LondonPrivateId)
    if (
        state.machineState !== 'StockRound' ||
        state.stockRound.completed ||
        !state.activePlayerIds.includes(playerId) ||
        state.stockRound.turn.bought ||
        state.stockRound.turn.corporateAction ||
        londonUsed(state) ||
        owner?.kind !== 'player' ||
        owner.playerId !== playerId ||
        getCompany(state, LondonPrivateId).closed
    )
        return []
    return state.certificates.flatMap((certificate) =>
        !certificate.retired &&
        certificate.kind === 'share' &&
        !certificate.president &&
        certificate.owner.kind === 'bank' &&
        certificate.poolId === 'initial-offering' &&
        startedThisRound(state, certificate.companyId) &&
        evaluateLondonShare(state, playerId, certificate.id).details
            ? [certificate.id]
            : []
    )
}

function evaluateLondonShare(
    state: EighteenThirtyTwoState,
    playerId: string,
    certificateId: string
) {
    return evaluateShareAcquisition(
        state,
        { playerId, buyer: { kind: 'player', playerId }, certificateId },
        EighteenThirtyTwoStockRules,
        { price: 0, recipient: { kind: 'bank' }, payers: [] }
    )
}

export const TakeLondonShare = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('TakeLondonShare'),
        certificateId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    companyId: Type.String(),
                    presidency: Type.Optional(PresidencyChange),
                    presidencyClaim: Type.Optional(PresidencyClaim)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type TakeLondonShare = Type.Static<typeof TakeLondonShare>
const Validator = Compile(TakeLondonShare)
export function isTakeLondonShare(action: GameAction): action is TakeLondonShare {
    return (
        action instanceof HydratedTakeLondonShare ||
        (action.type === 'TakeLondonShare' && Validator.Check(action))
    )
}

export class HydratedTakeLondonShare
    extends HydratableAction<typeof TakeLondonShare>
    implements TakeLondonShare
{
    declare type: 'TakeLondonShare'
    declare playerId: string
    declare certificateId: string
    declare metadata?: TakeLondonShare['metadata']
    constructor(data: TakeLondonShare) {
        super(data instanceof HydratedTakeLondonShare ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            londonShareChoices(state, this.playerId).includes(this.certificateId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'The London Investment Company cannot take this share')
        const { details } = evaluateLondonShare(state, this.playerId, this.certificateId)
        assert(details, 'A valid London share has transfer details')
        applyShareTransfer(state, details)
        markTurnPurchase(state)
        recordStockAction(state, this.playerId, EighteenThirtyTwoStockRules.round)
        state.usedPrivatePowerIds.push(LondonPrivateId)
        state.londonCompanyId = details.companyId
        this.metadata = {
            companyId: details.companyId,
            ...(details.presidency ? { presidency: details.presidency } : {}),
            ...(details.presidencyClaim ? { presidencyClaim: details.presidencyClaim } : {})
        }
    }
}

export const TakeLondonShareStep = titleStepAction(
    'TakeLondonShare',
    (action: HydratedAction) => action instanceof HydratedTakeLondonShare,
    (state, playerId) => londonShareChoices(state, playerId).length > 0
)

/** One share choice for each company the London Investment Company may buy into. */
export function londonShareCompanies(
    state: EighteenThirtyTwoState,
    playerId: string
): { companyId: string; certificateId: string }[] {
    const choices = new Map<string, string>()
    for (const certificateId of londonShareChoices(state, playerId)) {
        const certificate = state.certificates.find((item) => item.id === certificateId)
        assertExists(certificate, 'A London share choice names a certificate')
        if (!choices.has(certificate.companyId)) choices.set(certificate.companyId, certificateId)
    }
    return [...choices].map(([companyId, certificateId]) => ({ companyId, certificateId }))
}

/** London Investment closes once the company whose share it bought pays a dividend (§16.2 P4). */
export const closesLondonAfterDividend: PrivateRules['operationEffects'] = (state, companyId) => {
    const title = requireEighteenThirtyTwoState(state)
    if (title.londonCompanyId !== companyId || getCompany(title, LondonPrivateId).closed) return []
    assertExists(title.earningsDistribution, 'Private effects follow a distribution')
    return title.earningsDistribution.dividendPerShare > 0
        ? [{ kind: 'close', privateCompanyId: LondonPrivateId }]
        : []
}

/** Once used, the London Investment Company cannot change hands between players (§16.2 P4). */
export function londonTradable(state: StockState, privateCompanyId: string): boolean {
    return privateCompanyId !== LondonPrivateId || !londonUsed(requireEighteenThirtyTwoState(state))
}
