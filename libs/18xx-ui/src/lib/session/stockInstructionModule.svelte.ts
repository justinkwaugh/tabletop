import { assert, assertExists } from '@tabletop/common'
import {
    SetStockInstruction,
    certificatesInPool,
    sharesOwned,
    describeStockPositionChange,
    standingStockInstructionFor,
    standingStockInstructions,
    type CertificatePool,
    type Company,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type StockInstruction
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

type InstructionState = Parameters<typeof describeStockPositionChange>[0] &
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
    all = $derived.by(() => (this.open ? standingStockInstructions(this.session.state) : []))
    mine = $derived.by(() =>
        this.open && this.session.playerId
            ? standingStockInstructionFor(this.session.state, this.session.playerId)
            : undefined
    )
    available = $derived.by(
        () => this.open && this.session.validActionTypes.includes('SetStockInstruction')
    )
    canDeclare = $derived.by(() => this.available && this.session.interactive)
    warning = $derived.by(() =>
        this.mine
            ? describeStockPositionChange(
                  this.session.state,
                  this.mine,
                  this.session.rules.stockRules
              )
            : undefined
    )
    buyChoices = $derived.by((): BuyInstructionChoice[] => {
        const { state, rules, playerId } = this.session
        if (!playerId) return []
        const buyer = { kind: 'player', playerId } as const
        return state.companies
            .filter((company) => company.shareCount && company.started && !company.closed)
            .map((company) => ({
                company,
                pools: state.certificatePools.filter((pool) =>
                    certificatesInPool(state, pool.id).some(
                        (certificate) =>
                            certificate.kind === 'share' &&
                            certificate.companyId === company.id &&
                            !certificate.president &&
                            typeof rules.stockRules.purchaseTerms(state, certificate, buyer) !==
                                'string'
                    )
                )
            }))
            .filter((choice) => choice.pools.length > 0)
    })

    shareGoalRange(choice: BuyInstructionChoice): ShareGoalRange | undefined {
        const { state, rules, playerId } = this.session
        const shareCount = choice.company.shareCount
        if (!playerId || !shareCount) return undefined
        const buyer = { kind: 'player', playerId } as const
        const owned = sharesOwned(state, choice.company.id, buyer)
        const holdingCeiling = Math.floor(
            Math.max(
                (rules.stockRules.ownershipLimit(state, choice.company.id, buyer) * shareCount) /
                    100,
                ...state.ownershipLimitExemptions
                    .filter(
                        (exemption) =>
                            exemption.companyId === choice.company.id &&
                            exemption.owner.kind === 'player' &&
                            exemption.owner.playerId === playerId
                    )
                    .map((exemption) => exemption.maximumShares)
            )
        )
        const purchasable = choice.pools
            .flatMap((pool) => certificatesInPool(state, pool.id))
            .reduce(
                (sum, certificate) =>
                    sum +
                    (certificate.kind === 'share' &&
                    certificate.companyId === choice.company.id &&
                    !certificate.president &&
                    typeof rules.stockRules.purchaseTerms(state, certificate, buyer) !== 'string'
                        ? certificate.shares
                        : 0),
                0
            )
        const range = { min: owned + 1, max: Math.min(holdingCeiling, owned + purchasable) }
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
            const range = this.shareGoalRange(choice)
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
        await this.session.applyAction(
            this.session.createPlayerAction(SetStockInstruction, {
                outOfTurn: true,
                ...(instruction ? { instruction } : {})
            })
        )
    }
}
