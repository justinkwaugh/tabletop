import {
    AssignEngineer,
    ChooseInvestor,
    ClaimWoosongPayment,
    ExchangeRocket,
    MergeInvestor,
    ReplaceInvestorStation,
    TitleRules1880,
    engineerCompany,
    forcedRocketCompanies,
    mergerReplaces,
    ownerDirectsMerger,
    rocketCompany,
    unchosenInvestors,
    woosongPayment,
    type HydratedState1880,
    type State1880
} from '@tabletop/1880'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import { RepayPlayerLoan, playerLoan, repayablePlayerLoan, trainsOwnedBy } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { MapView1880 } from './mapView.js'
import { Presentation1880 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1880, HydratedState1880>
> = createEighteenXXSessionClass<typeof State1880, HydratedState1880>(
    TitleRules1880,
    MapView1880,
    Presentation1880,
    createRouteWorker
)

export class Session1880 extends BaseSession {
    // P6 comes with the BCR's director's certificate (§VI).
    override privateCompanyTokens = $derived({ P6: this.mapView.stations.BCR })

    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private readonly me = $derived(this.canChooseAction ? this.myPlayer?.id : undefined)
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    // Choosing foreign investors (§VII).
    readonly investorChoices = $derived(
        this.can('ChooseInvestor') ? unchosenInvestors(this.gameState) : []
    )
    async chooseInvestor(investorId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ChooseInvestor, { investorId }))
    }

    // An investor joining its company (§VII).
    readonly merger = $derived(
        this.can('MergeInvestor') ? this.gameState.investorMerger : undefined
    )
    // An owner who directs the company also chooses its station; else its director does after.
    readonly mergerReplaces = $derived(
        this.merger
            ? ownerDirectsMerger(this.gameState, this.merger) &&
                  mergerReplaces(this.gameState, this.merger)
            : false
    )
    readonly stationChoice = $derived(
        this.can('ReplaceInvestorStation') ? this.gameState.investorMerger : undefined
    )
    async replaceInvestorStation(replaceStation: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(ReplaceInvestorStation, { replaceStation }))
    }
    async mergeInvestor(treasuryTo: 'company' | 'owner', replaceStation: boolean): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(MergeInvestor, { treasuryTo, replaceStation })
        )
    }

    // The privates' powers (§VI).
    readonly woosongPayment = $derived(
        this.can('ClaimWoosongPayment') ? woosongPayment(this.gameState) : undefined
    )
    async claimWoosong(): Promise<void> {
        const amount = this.woosongPayment
        assertExists(amount, 'P0’s payment is open')
        await this.applyAction(this.createPlayerAction(ClaimWoosongPayment, { amount }))
    }
    readonly engineerCompany = $derived(
        this.me && this.can('AssignEngineer') ? engineerCompany(this.gameState, this.me) : undefined
    )
    async assignEngineer(): Promise<void> {
        const companyId = this.engineerCompany
        assertExists(companyId, 'P5 may be assigned')
        await this.applyAction(this.createPlayerAction(AssignEngineer, { companyId }))
    }
    readonly forcedRocket = $derived(
        this.can('ExchangeRocket') && this.gameState.machineState === 'ExchangingRocket'
            ? forcedRocketCompanies(this.gameState)
            : undefined
    )
    readonly rocketCompany = $derived(
        this.me && this.can('ExchangeRocket') && !this.forcedRocket
            ? rocketCompany(this.gameState, this.me)
            : undefined
    )
    rocketDiscards(companyId: string) {
        return trainsOwnedBy(this.gameState, { kind: 'company', companyId })
    }
    async exchangeRocket(companyId: string, discardTrainId?: string): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(ExchangeRocket, {
                companyId,
                ...(discardTrainId ? { discardTrainId } : {})
            })
        )
    }

    // A director's debt (§X Forced Train Purchase).
    readonly debtRepayment = $derived.by(() => {
        const playerId = this.me
        if (!playerId || !this.can('RepayPlayerLoan')) return undefined
        return {
            owed: playerLoan(this.gameState, playerId),
            most: repayablePlayerLoan(this.gameState, playerId)
        }
    })
    async repayDebt(amount: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(RepayPlayerLoan, { amount }))
    }
}

export function requireSession1880(
    session: GameSession<State1880, HydratedState1880>
): Session1880 {
    assert(session instanceof Session1880, '1880 requires its title session')
    return session
}
