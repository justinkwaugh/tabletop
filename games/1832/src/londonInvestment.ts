import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
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
import { requireEighteenThirtyTwoState, type HydratedEighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import type { TitleStepAction } from './titleActions.js'
import { inGame, requireTitleState, type EighteenThirtyTwoTitleState } from './titleState.js'

export const LondonPrivateId = 'P4'

/** Records the stock round in which a company's president's certificate was bought. */
export const recordCompanyStart: NonNullable<CompanyRules['onStart']> = (state, details) => {
    requireTitleState(state).companyStarts[details.companyId] = state.stockRound.number
}

function startedThisRound(state: StockState & EighteenThirtyTwoTitleState, companyId: string) {
    return (
        state.companyStarts[companyId] === state.stockRound.number ||
        (companyId === 'CG' && state.stockRound.number === 1 && getCompany(state, 'CG').started)
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
export function londonShareChoices(
    state: HydratedEighteenThirtyTwoState,
    playerId: string
): string[] {
    if (!inGame(state, LondonPrivateId)) return []
    const owner = privateOwner(state, LondonPrivateId)
    if (
        state.machineState !== 'StockRound' ||
        state.stockRound.completed ||
        state.stockRound.turn.bought ||
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
    state: HydratedEighteenThirtyTwoState,
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

export const TakeLondonShareStep: TitleStepAction = {
    type: 'TakeLondonShare',
    available: (state, playerId) => londonShareChoices(state, playerId).length > 0,
    isValid: (action: HydratedAction, state) =>
        action instanceof HydratedTakeLondonShare && action.isValid(state)
}

/** London Investment closes once the company whose share it bought pays a dividend (§16.2 P4). */
export const closesLondonAfterDividend: PrivateRules['operationEffects'] = (state, companyId) => {
    const title = requireEighteenThirtyTwoState(state)
    return title.londonCompanyId === companyId &&
        !getCompany(title, LondonPrivateId).closed &&
        (title.earningsDistribution?.dividendPerShare ?? 0) > 0
        ? [{ kind: 'close', privateCompanyId: LondonPrivateId }]
        : []
}

/** Once used, the London Investment Company cannot change hands between players (§16.2 P4). */
export function londonTradable(state: StockState, privateCompanyId: string): boolean {
    return privateCompanyId !== LondonPrivateId || !londonUsed(requireEighteenThirtyTwoState(state))
}
