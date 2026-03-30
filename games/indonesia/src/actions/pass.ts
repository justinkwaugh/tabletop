import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceCity } from './placeCity.js'
import { HydratedDeliverGood } from './deliverGood.js'
import { HydratedExpand } from './expand.js'
import { HydratedStartCompany } from './startCompany.js'
import {
    describeProductionOperation,
    ProductionOperationStage
} from '../operations/productionOperationProgress.js'
import { mergerAnnouncementOrder } from '../operations/mergers.js'

export enum PassReason {
    CannotPlaceCity = 'CannotPlaceCity',
    DeclineStartCompany = 'DeclineStartCompany',
    DeclineMergerAnnouncement = 'DeclineMergerAnnouncement',
    NoValidOperation = 'NoValidOperation',
    FinishOptionalShippingExpansion = 'FinishOptionalShippingExpansion',
    SkipShippingExpansion = 'SkipShippingExpansion',
    FinishOptionalProductionExpansion = 'FinishOptionalProductionExpansion',
    SkipProductionExpansion = 'SkipProductionExpansion'
}

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Pass), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PassMetadata), // Always optional, because it is an output
            reason: Type.Enum(PassReason)
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: PassMetadata
    declare reason: PassReason

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPass(state)) {
            throw Error('Invalid Pass action')
        }

        this.metadata = {}
    }

    isValidPass(state: HydratedIndonesiaGameState): boolean {
        return HydratedPass.canPass(state, this.playerId, this.reason)
    }

    static canPass(state: HydratedIndonesiaGameState, playerId: string, reason?: PassReason): boolean {
        if (state.machineState === MachineState.NewEra) {
            return (
                (reason === undefined || reason === PassReason.CannotPlaceCity) &&
                !HydratedPlaceCity.canPlaceCity(state, playerId)
            )
        }

        if (state.machineState === MachineState.Acquisitions) {
            return (
                (reason === undefined || reason === PassReason.DeclineStartCompany) &&
                HydratedStartCompany.canStartCompany(state, playerId) &&
                !state.hasPlayerPassedAcquisitions(playerId)
            )
        }

        if (state.machineState === MachineState.Mergers) {
            if (
                reason !== undefined &&
                reason !== PassReason.DeclineMergerAnnouncement
            ) {
                return false
            }
            if (state.activeMergerProposal || state.pendingSiapSajiReduction) {
                return false
            }
            if (state.activePlayerIds[0] !== playerId) {
                return false
            }

            return mergerAnnouncementOrder(state).includes(playerId)
        }

        if (state.machineState === MachineState.ShippingOperations) {
            const operatingCompanyId = state.operatingCompanyId
            if (!operatingCompanyId) {
                return false
            }

            const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
            if (!operatingCompany || operatingCompany.owner !== playerId) {
                return false
            }

            if (reason === PassReason.FinishOptionalShippingExpansion || reason === undefined) {
                return true
            }

            if (reason === PassReason.NoValidOperation) {
                return !HydratedExpand.canExpand(state, playerId)
            }

            if (reason === PassReason.SkipShippingExpansion) {
                return !HydratedExpand.canExpand(state, playerId)
            }

            return false
        }

        if (state.machineState !== MachineState.ProductionOperations) {
            return false
        }

        const productionProgress = describeProductionOperation(state)
        if (!productionProgress) {
            return false
        }
        if (productionProgress.ownerPlayerId !== playerId) {
            return false
        }

        const canExpand = HydratedExpand.canExpand(state, playerId)

        if (
            reason === PassReason.FinishOptionalProductionExpansion ||
            (reason === undefined &&
                productionProgress.stage === ProductionOperationStage.OptionalExpansion &&
                canExpand)
        ) {
            return productionProgress.stage === ProductionOperationStage.OptionalExpansion
        }

        if (
            reason === PassReason.SkipProductionExpansion ||
            (reason === undefined &&
                productionProgress.stage !== ProductionOperationStage.Delivery &&
                !canExpand)
        ) {
            if (productionProgress.stage === ProductionOperationStage.Delivery) {
                return false
            }
            return !canExpand
        }

        if (reason === PassReason.NoValidOperation) {
            return !HydratedDeliverGood.canDeliverGood(state, playerId) && !canExpand
        }

        return false
    }
}
