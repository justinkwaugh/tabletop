import {
    AnswerRedemption,
    ConsentingRedemptionState,
    DeclineProtection,
    ProtectShares,
    ProtectingPriceState,
    RedeemShare,
    ReissueShares,
    finiteCashOwnedBy,
    getCompany,
    companyShareCount,
    sharesOwned,
    type HydratedEighteenXXState,
    type Owner,
    type PriceProtectionProcedure,
    type PriceProtectionState,
    type RedemptionChoice,
    type ReissueChoice,
    type ShareRedemptionProcedure,
    type ShareRedemptionState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import type { BaseSession } from '../session/moduleSession.js'
import type { MoneyFormat } from '../presentation/money.js'
import type { TitleFact } from '../session/titlePresentation.js'
import type { AwaitedDecision } from '../table/awaitedDecision.js'

export type CompanyShareOptions = {
    companyId: string
    redemptions: RedemptionChoice[]
    reissue?: ReissueChoice
}

type ShareActionsState = HydratedEighteenXXState & PriceProtectionState & ShareRedemptionState

type ShareActionsSession<State extends ShareActionsState> = {
    readonly gameState: State
    readonly validActionTypes: readonly string[]
    readonly canChooseAction: boolean
    createPlayerAction: BaseSession['createPlayerAction']
    applyAction: BaseSession['applyAction']
    companyName(companyId: string): string
}

export type ShareActionNames = {
    companyName(companyId: string): string
    companyInitials(companyId: string): string
    playerName(playerId: string): string
    money: MoneyFormat
}

export function redemptionHolderName(holder: Owner, playerName: (id: string) => string): string {
    return holder.kind === 'player' ? playerName(holder.playerId) : 'the market'
}

export class ShareActions<State extends ShareActionsState> {
    constructor(
        private readonly session: ShareActionsSession<State>,
        private readonly protection: PriceProtectionProcedure<State>,
        private readonly redemption: ShareRedemptionProcedure<State>
    ) {}

    readonly companyOptions = $derived.by((): CompanyShareOptions[] => {
        const state = this.session.gameState
        const playerId = state.activePlayerIds[0]
        if (
            !playerId ||
            !(
                this.session.validActionTypes.includes('RedeemShare') ||
                this.session.validActionTypes.includes('ReissueShares')
            )
        )
            return []
        const redemptions = this.redemption.redemptionChoices(state, playerId)
        const reissues = this.redemption.reissueChoices(state, playerId)
        const companyIds = [
            ...new Set([...redemptions, ...reissues].map((choice) => choice.companyId))
        ]
        return companyIds.map((companyId) => {
            const reissue = reissues.find((choice) => choice.companyId === companyId)
            return {
                companyId,
                redemptions: redemptions.filter((choice) => choice.companyId === companyId),
                ...(reissue ? { reissue } : {})
            }
        })
    })

    readonly redemptionPrompt = $derived.by(() => {
        const state = this.session.gameState
        const request = state.redemptionRequest
        if (state.machineState !== ConsentingRedemptionState || !request) return undefined
        return { ...request, companyName: this.session.companyName(request.companyId) }
    })
    readonly canAnswerRedemption = $derived.by(
        () =>
            this.session.canChooseAction &&
            this.session.validActionTypes.includes('AnswerRedemption')
    )

    readonly protectionPrompt = $derived.by(() => this.protectionTerms(this.session.gameState))
    readonly canDecideProtection = $derived.by(
        () =>
            this.session.canChooseAction && this.session.validActionTypes.includes('ProtectShares')
    )
    readonly pending = $derived.by(() => !!this.redemptionPrompt || !!this.protectionPrompt)

    protectionTerms(state: State) {
        const record = state.priceProtection
        const decision =
            state.machineState === ProtectingPriceState
                ? this.protection.decision(state)
                : undefined
        if (!record || !decision) return undefined
        const market = this.protection.rules.market.chart
        return {
            ...decision.sale,
            sellerPlayerId: record.sellerPlayerId,
            presidentPlayerId: decision.playerId,
            price: market.companySpace(state.stockMarket, decision.sale.companyId).price,
            declinedPrice: market.space(this.protection.declinedMarketSpaceId(state, decision.sale))
                .price
        }
    }

    awaitedDecision(state: State, names: ShareActionNames): AwaitedDecision | undefined {
        if (state.machineState === ProtectingPriceState) {
            const terms = this.protectionTerms(state)
            if (!terms) return undefined
            const shares = `${terms.shares} ${names.companyInitials(terms.companyId)} ${terms.shares === 1 ? 'share' : 'shares'}`
            return {
                title: 'Price protection',
                companyId: terms.companyId,
                text: `${names.playerName(terms.sellerPlayerId)} sold ${shares} for ${names.money(terms.proceeds)}. ${names.playerName(terms.presidentPlayerId)} may buy ${terms.shares === 1 ? 'it' : 'them'} to keep the price at ${names.money(terms.price)}${terms.declinedPrice === terms.price ? '' : `, or let it drop to ${names.money(terms.declinedPrice)}`}`
            }
        }
        if (state.machineState === ConsentingRedemptionState && state.redemptionRequest) {
            const { companyId, holderPlayerId, price } = state.redemptionRequest
            return {
                title: 'Share redemption',
                companyId,
                text: `${names.companyName(companyId)} asks to redeem one of ${names.playerName(holderPlayerId)}’s shares for ${names.money(price)}`
            }
        }
        return undefined
    }

    companyFacts(companyId: string, money: MoneyFormat): TitleFact[] {
        const state = this.session.gameState
        const company = getCompany(state, companyId)
        const shareCount = companyShareCount(state, this.redemption.rules.charters, companyId)
        assertExists(shareCount, 'A company acting for its shares has a share count')
        assertExists(company.parPrice, 'A company acting for its shares has a par price')
        const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
        const spendable = this.redemption.spendableCash(state, companyId)
        const redeemed = sharesOwned(state, companyId, { kind: 'company', companyId })
        return [
            { label: 'Cash', value: money(cash) },
            ...(spendable === cash ? [] : [{ label: 'Spendable', value: money(spendable) }]),
            { label: 'Redeemed', value: `${(redeemed * 100) / shareCount}%` },
            { label: 'Par', value: money(company.parPrice) }
        ]
    }

    companyPrice(companyId: string): number {
        return this.redemption.rules.market.companySpace(
            this.session.gameState.stockMarket,
            companyId
        ).price
    }

    async redeemShare(choice: RedemptionChoice): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(RedeemShare, {
                companyId: choice.companyId,
                certificateId: choice.certificateId
            })
        )
    }
    async answerRedemption(accept: boolean): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(AnswerRedemption, { accept })
        )
    }
    async reissueShares(companyId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(ReissueShares, { companyId })
        )
    }
    async protectShares(companyId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(ProtectShares, { companyId })
        )
    }
    async declineProtection(companyId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(DeclineProtection, { companyId })
        )
    }
}
