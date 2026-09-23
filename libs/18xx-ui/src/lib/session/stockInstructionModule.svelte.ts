import { assert, assertExists } from '@tabletop/common'
import {
    SetStockInstruction,
    certificatesInPool,
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
        const { state } = this.session
        return state.companies
            .filter((company) => company.shareCount && company.started && !company.closed)
            .map((company) => ({
                company,
                pools: state.certificatePools.filter((pool) =>
                    certificatesInPool(state, pool.id).some(
                        (certificate) =>
                            certificate.kind === 'share' &&
                            certificate.companyId === company.id &&
                            !certificate.president
                    )
                )
            }))
            .filter((choice) => choice.pools.length > 0)
    })

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
