import { assert, assertExists } from '@tabletop/common'
import {
    SetStockInstruction,
    cashOwnedBy,
    lastStoppedStockInstruction,
    purchasableShares,
    purchaseOwnershipCeiling,
    sharesOwned,
    standingStockInstructionFor,
    stockPositionChange,
    type CertificatePool,
    type Company,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type StockInstruction,
    type StockInstructionStopReason,
    type StoppedStockInstruction
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

type InstructionState = Parameters<typeof stockPositionChange>[0] &
    Pick<EighteenXXState, 'machineState'>

export type StockInstructionSession = ModuleSession<
    InstructionState,
    Pick<EighteenXXTitleRules, 'stockRules'>
>

export type BuyInstructionTerms = Omit<Extract<StockInstruction, { kind: 'buy' }>, 'kind'>

export type BuyInstructionChoice = { company: Company; pools: CertificatePool[] }
export type ShareGoalRange = { min: number; max: number }

export class StockInstructionModule {
    constructor(private readonly session: StockInstructionSession) {}

    private open = $derived.by(
        () =>
            this.session.state.machineState === 'StockRound' &&
            !this.session.state.stockRound.completed
    )
    mine = $derived.by(() =>
        this.open && this.session.playerId
            ? standingStockInstructionFor(this.session.state, this.session.playerId)
            : undefined
    )
    available = $derived.by(
        () =>
            this.open &&
            this.session.validActionTypes.includes('SetStockInstruction') &&
            (!this.session.ordinaryHotseatPlay || this.session.viewingAsNonActivePlayer)
    )
    canDeclare = $derived.by(() => this.available && this.session.interactive)
    warning = $derived.by(() =>
        this.mine
            ? stockPositionChange(this.session.state, this.mine, this.session.rules.stockRules)
            : undefined
    )
    lastStop = $derived.by((): StoppedStockInstruction | undefined => {
        const { recordedActions, playerId } = this.session
        if (!this.open || !playerId || this.mine) return undefined
        return lastStoppedStockInstruction(recordedActions, playerId)
    })
    buyChoices = $derived.by((): BuyInstructionChoice[] => {
        const { state, rules, playerId } = this.session
        if (!playerId) return []
        const buyer = { kind: 'player', playerId } as const
        return state.companies
            .filter((company) => company.shareCount && company.started && !company.closed)
            .map((company) => ({
                company,
                pools: state.certificatePools.filter(
                    (pool) =>
                        purchasableShares(state, pool.id, company.id, buyer, rules.stockRules)
                            .length > 0
                )
            }))
            .filter(
                (choice) =>
                    choice.pools.length > 0 &&
                    (!choice.company.floated ||
                        choice.pools.some(
                            (pool) => this.shareGoalRange(choice, pool.id) !== undefined
                        ))
            )
    })

    shareGoalRange(
        choice: BuyInstructionChoice,
        preferredPoolId: string
    ): ShareGoalRange | undefined {
        const { state, rules, playerId } = this.session
        if (!playerId) return undefined
        const buyer = { kind: 'player', playerId } as const
        const companyId = choice.company.id
        const owned = sharesOwned(state, companyId, buyer)
        const offers = choice.pools.map((pool) => ({
            pool,
            shares: purchasableShares(state, pool.id, companyId, buyer, rules.stockRules)
        }))
        const uniform = (offer: (typeof offers)[number]) =>
            new Set(offer.shares.map((share) => share.certificate.shares)).size <= 1
        const preferred = offers.filter((offer) => offer.pool.id === preferredPoolId)
        if (preferred.some((offer) => offer.shares.length && !uniform(offer))) return undefined
        const sequence = preferred.some((offer) => offer.shares.length)
            ? preferred
            : offers
                  .filter((offer) => offer.pool.id !== preferredPoolId && uniform(offer))
                  .toSorted(
                      (left, right) =>
                          Math.min(...left.shares.map((share) => share.price)) -
                          Math.min(...right.shares.map((share) => share.price))
                  )
        const cash = cashOwnedBy(state, buyer)
        let remaining = typeof cash === 'number' ? cash : Infinity
        let reachable = owned
        walk: for (const offer of sequence)
            for (const share of offer.shares.toSorted((left, right) => left.price - right.price)) {
                if (share.price > remaining) break walk
                remaining -= share.price
                reachable += share.certificate.shares
            }
        const range = {
            min: owned + 1,
            max: Math.min(
                purchaseOwnershipCeiling(state, companyId, buyer, rules.stockRules),
                reachable
            )
        }
        return range.max >= range.min ? range : undefined
    }

    async declarePass() {
        await this.set({ kind: 'pass' })
    }
    async declareBuy(terms: BuyInstructionTerms) {
        const choice = this.buyChoices.find((choice) => choice.company.id === terms.companyId)
        assertExists(choice, 'Choose a company with shares available to buy')
        assert(
            choice.pools.some((pool) => pool.id === terms.preferredPoolId),
            'Choose a pool holding shares of the company'
        )
        if (terms.until.kind === 'shares') {
            const range = this.shareGoalRange(choice, terms.preferredPoolId)
            assert(
                range && terms.until.count >= range.min && terms.until.count <= range.max,
                'Choose a share goal the player can reach'
            )
        }
        await this.set({ kind: 'buy', ...terms })
    }
    async clear() {
        assertExists(this.mine, 'There is no standing instruction to clear')
        await this.set(undefined)
    }

    private async set(instruction: StockInstruction | undefined) {
        assert(this.canDeclare, 'Standing instructions are unavailable')
        const superseded = this.session.supersededAction(SetStockInstruction.properties.type.const)
        await this.session.applyAction(
            this.session.createPlayerAction(SetStockInstruction, {
                outOfTurn: true,
                supersedable: true,
                ...(superseded ? { supersedesActionId: superseded.id } : {}),
                ...(instruction ? { instruction } : {})
            })
        )
    }
}

export function shareGoalWithin(range: ShareGoalRange, count: number): number {
    return Math.min(Math.max(count, range.min), range.max)
}
