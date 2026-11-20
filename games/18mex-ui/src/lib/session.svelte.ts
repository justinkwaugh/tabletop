import {
    ChooseExchangeStation,
    DeclineNdmMerger,
    MergeIntoNdm,
    TitleRulesMex,
    floatedMergeCandidates,
    mergerDecider,
    mergerPayout,
    unfloatedMergeCandidates,
    type HydratedStateMex,
    type StateMex
} from '@tabletop/18mex'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { MapViewMex } from './mapView.js'
import { PresentationMex } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof StateMex, HydratedStateMex>
> = createEighteenXXSessionClass<typeof StateMex, HydratedStateMex>(
    TitleRulesMex,
    MapViewMex,
    PresentationMex,
    createRouteWorker
)

/** The NdM merger decision in front of this player, if any (5.3). */
export type MergerDecision =
    | { kind: 'offer'; options: readonly { companyId: string; payout: number }[] }
    | { kind: 'unfloated'; companyIds: readonly string[] }
    | { kind: 'station'; companyId?: string; locationIds: readonly string[] }

export class SessionMex extends BaseSession {
    private readonly deciding = $derived(this.isPlayable && this.isMyTurn && !this.isViewingHistory)
    private get playerId(): string {
        const playerId = this.myPlayer?.id
        assertExists(playerId, 'A player acts')
        return playerId
    }

    /** The merger decision this player makes now: merging a company, or the exchange token's place. */
    readonly mergerDecision: MergerDecision | undefined = $derived.by(() => {
        const state = this.gameState
        const merger = state.ndmMerger
        if (!merger || !this.deciding || mergerDecider(state) !== this.myPlayer?.id)
            return undefined
        if (merger.stage === 'offering')
            return {
                kind: 'offer',
                options: floatedMergeCandidates(state, this.playerId).map((companyId) => ({
                    companyId,
                    payout: mergerPayout(state, companyId, this.playerId)
                }))
            }
        if (merger.stage === 'choosing-company')
            return { kind: 'unfloated', companyIds: unfloatedMergeCandidates(state) }
        return {
            kind: 'station',
            ...(merger.mergedCompanyId ? { companyId: merger.mergedCompanyId } : {}),
            locationIds: (merger.stationChoices ?? []).map((choice) => choice.locationId)
        }
    })
    /** Who the merger waits on, when it is someone else. */
    readonly mergerWaitingOn: string | undefined = $derived.by(() => {
        const decider = this.gameState.ndmMerger ? mergerDecider(this.gameState) : undefined
        return decider && decider !== this.myPlayer?.id ? decider : undefined
    })
    async mergeIntoNdm(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(MergeIntoNdm, { companyId }))
    }
    async declineMerger(): Promise<void> {
        await this.applyAction(this.createPlayerAction(DeclineNdmMerger, {}))
    }
    async chooseExchangeStation(locationId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ChooseExchangeStation, { locationId }))
    }
}

export function requireSessionMex(session: GameSession<StateMex, HydratedStateMex>): SessionMex {
    assert(session instanceof SessionMex, '18MEX requires its title session')
    return session
}
