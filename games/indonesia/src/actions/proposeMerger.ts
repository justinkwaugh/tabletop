import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AuctionType,
    GameAction,
    HydratableAction,
    HydratedSimpleAuction,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedIndonesiaGameState, type ActiveMergerProposal } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    buildMergerBidOrder,
    listLegalMergerOptionsForAnnouncer,
    type LegalMergerOption
} from '../operations/mergers.js'

export type ProposeMergerMetadata = Type.Static<typeof ProposeMergerMetadata>
export const ProposeMergerMetadata = Type.Object({
    proposal: Type.Object({
        companyAId: Type.String(),
        companyBId: Type.String(),
        nominalValue: Type.Number(),
        bidIncrement: Type.Number(),
        totalUnits: Type.Number(),
        eligibleBidderIds: Type.Array(Type.String())
    })
})

export type ProposeMerger = Type.Static<typeof ProposeMerger>
export const ProposeMerger = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ProposeMerger),
            playerId: Type.String(),
            metadata: Type.Optional(ProposeMergerMetadata),
            companyAId: Type.String(),
            companyBId: Type.String()
        })
    ])
)

export const ProposeMergerValidator = Compile(ProposeMerger)

export function isProposeMerger(action?: GameAction): action is ProposeMerger {
    return action?.type === ActionType.ProposeMerger
}

function toActiveProposal(option: LegalMergerOption): ActiveMergerProposal {
    return {
        announcerId: option.announcerId,
        companyAId: option.companyAId,
        companyBId: option.companyBId,
        companyType: option.companyType,
        resultingGood: option.resultingGood,
        isSiapSaji: option.isSiapSaji,
        totalUnits: option.totalUnits,
        nominalValue: option.nominalValue,
        bidIncrement: option.bidIncrement,
        companies: option.companies
    }
}

export class HydratedProposeMerger extends HydratableAction<typeof ProposeMerger> implements ProposeMerger {
    declare type: ActionType.ProposeMerger
    declare playerId: string
    declare metadata?: ProposeMergerMetadata
    declare companyAId: string
    declare companyBId: string

    constructor(data: ProposeMerger) {
        super(data, ProposeMergerValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidProposeMerger(state)) {
            throw Error('Invalid ProposeMerger action')
        }

        const option = HydratedProposeMerger.findOption(
            state,
            this.playerId,
            this.companyAId,
            this.companyBId
        )
        assertExists(option, 'Expected merger option to exist while proposing merger')

        const eligibleBidderIds = option.eligibleBidderIds
        const bidOrder = buildMergerBidOrder(state, this.playerId, eligibleBidderIds)
        const auction = new HydratedSimpleAuction({
            id: this.id,
            type: AuctionType.Simple,
            participants: eligibleBidderIds.map((playerId) => ({
                playerId,
                passed: false
            })),
            auctioneerId: this.playerId
        })

        state.activeMergerProposal = toActiveProposal(option)
        state.activeMergerAuction = auction
        state.mergerBidOrder = bidOrder
        state.mergerCurrentBidderId = this.playerId

        this.metadata = {
            proposal: {
                companyAId: option.companyAId,
                companyBId: option.companyBId,
                nominalValue: option.nominalValue,
                bidIncrement: option.bidIncrement,
                totalUnits: option.totalUnits,
                eligibleBidderIds
            }
        }
    }

    isValidProposeMerger(state: HydratedIndonesiaGameState): boolean {
        if (state.machineState !== MachineState.Mergers) {
            return false
        }

        if (state.activeMergerProposal || state.activeMergerAuction || state.pendingSiapSajiReduction) {
            return false
        }

        if (this.playerId !== state.activePlayerIds[0]) {
            return false
        }

        const mergerAnnouncementOrder = state.mergerAnnouncementOrder ?? []
        const mergerNextAnnouncerIndex = state.mergerNextAnnouncerIndex ?? 0
        if (mergerAnnouncementOrder[mergerNextAnnouncerIndex] !== this.playerId) {
            return false
        }

        const option = HydratedProposeMerger.findOption(
            state,
            this.playerId,
            this.companyAId,
            this.companyBId
        )
        if (!option) {
            return false
        }

        return state.getPlayerState(this.playerId).cash >= option.nominalValue
    }

    static listProposableMergers(
        state: HydratedIndonesiaGameState,
        playerId: string
    ): LegalMergerOption[] {
        return listLegalMergerOptionsForAnnouncer(state, playerId)
    }

    static canProposeMerger(state: HydratedIndonesiaGameState, playerId: string): boolean {
        return HydratedProposeMerger.listProposableMergers(state, playerId).length > 0
    }

    static findOption(
        state: HydratedIndonesiaGameState,
        playerId: string,
        companyAId: string,
        companyBId: string
    ): LegalMergerOption | undefined {
        return HydratedProposeMerger.listProposableMergers(state, playerId).find((option) => {
            return (
                (option.companyAId === companyAId && option.companyBId === companyBId) ||
                (option.companyAId === companyBId && option.companyBId === companyAId)
            )
        })
    }
}
