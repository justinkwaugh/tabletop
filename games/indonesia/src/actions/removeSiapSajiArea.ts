import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert, assertExists } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CompanyType } from '../definition/companyType.js'
import { AreaType, isCultivatedArea } from '../components/area.js'
import { Good } from '../definition/goods.js'
import { validSiapSajiRemovalAreaIds } from '../operations/mergers.js'

export type RemoveSiapSajiAreaMetadata = Type.Static<typeof RemoveSiapSajiAreaMetadata>
export const RemoveSiapSajiAreaMetadata = Type.Object({
    companyId: Type.String(),
    areaId: Type.String(),
    removalsRemaining: Type.Number()
})

export type RemoveSiapSajiArea = Type.Static<typeof RemoveSiapSajiArea>
export const RemoveSiapSajiArea = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RemoveSiapSajiArea),
            playerId: Type.String(),
            metadata: Type.Optional(RemoveSiapSajiAreaMetadata),
            areaId: Type.String()
        })
    ])
)

export const RemoveSiapSajiAreaValidator = Compile(RemoveSiapSajiArea)

export function isRemoveSiapSajiArea(action?: GameAction): action is RemoveSiapSajiArea {
    return action?.type === ActionType.RemoveSiapSajiArea
}

export class HydratedRemoveSiapSajiArea
    extends HydratableAction<typeof RemoveSiapSajiArea>
    implements RemoveSiapSajiArea
{
    declare type: ActionType.RemoveSiapSajiArea
    declare playerId: string
    declare metadata?: RemoveSiapSajiAreaMetadata
    declare areaId: string

    constructor(data: RemoveSiapSajiArea) {
        super(data, RemoveSiapSajiAreaValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidRemoveSiapSajiArea(state)) {
            throw Error('Invalid RemoveSiapSajiArea action')
        }

        const reduction = state.pendingSiapSajiReduction
        assertExists(reduction, 'Siap saji reduction state should exist while removing area')

        state.board.areas[this.areaId] = {
            id: this.areaId,
            type: AreaType.EmptyLand
        }

        reduction.removalsRemaining -= 1

        if (reduction.removalsRemaining <= 0) {
            this.finalizeSiapSajiReduction(state, reduction.companyId)
        } else {
            const validAreaIds = validSiapSajiRemovalAreaIds(state, reduction.companyId)
            assert(
                validAreaIds.length > 0,
                'Siap saji reduction must always have at least one removable border area'
            )
        }

        this.metadata = {
            companyId: reduction.companyId,
            areaId: this.areaId,
            removalsRemaining: Math.max(0, state.pendingSiapSajiReduction?.removalsRemaining ?? 0)
        }
    }

    isValidRemoveSiapSajiArea(state: HydratedIndonesiaGameState): boolean {
        if (state.activePlayerIds[0] !== this.playerId) {
            return false
        }

        const reduction = state.pendingSiapSajiReduction
        if (!reduction) {
            return false
        }

        if (reduction.winnerId !== this.playerId || reduction.removalsRemaining <= 0) {
            return false
        }

        return validSiapSajiRemovalAreaIds(state, reduction.companyId).includes(this.areaId)
    }

    static validAreaIds(state: HydratedIndonesiaGameState, playerId: string): string[] {
        const reduction = state.pendingSiapSajiReduction
        if (!reduction || reduction.winnerId !== playerId || reduction.removalsRemaining <= 0) {
            return []
        }

        return validSiapSajiRemovalAreaIds(state, reduction.companyId)
    }

    static canRemoveSiapSajiArea(state: HydratedIndonesiaGameState, playerId: string): boolean {
        return HydratedRemoveSiapSajiArea.validAreaIds(state, playerId).length > 0
    }

    private finalizeSiapSajiReduction(state: HydratedIndonesiaGameState, companyId: string): void {
        const company = state.companies.find((candidate) => candidate.id === companyId)
        if (company && company.type === CompanyType.Production) {
            company.good = Good.SiapSaji
        }

        for (const area of Object.values(state.board.areas)) {
            if (!isCultivatedArea(area) || area.companyId !== companyId) {
                continue
            }
            area.good = Good.SiapSaji
        }
        state.pendingSiapSajiReduction = undefined
    }
}
