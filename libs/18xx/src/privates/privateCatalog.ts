import { assert, assertExists } from '@tabletop/common'
import type { AuctionLot } from '../auctions/waterfallAuction.js'
import { privateOwner, type FinancialState } from '../finance/finance.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import type { PrivateEffect } from './privateRules.js'

export type PrivateDefinition = {
    id: string
    name: string
    faceValue: number
    revenue: number
    description?: string
    closure?: 'never' | { survivesWhilePlayerOwned: { revenue: number } }
    blocks?: { locationIds: readonly string[]; until: 'company-owned' | 'closed' }
    sale?: 'never' | { minimum: number; maximum: number }
}
export type PrivateCatalogDefinition = {
    closurePhaseId: string
    privates: readonly PrivateDefinition[]
}
type CatalogState = FinancialState & { phaseId: string }

export class PrivateCatalog {
    readonly privates: readonly PrivateDefinition[]
    private readonly closurePhaseId: string
    constructor(
        definition: PrivateCatalogDefinition,
        private readonly phases: PhaseTable
    ) {
        this.privates = definition.privates
        this.closurePhaseId = definition.closurePhaseId
        phases.phase(definition.closurePhaseId)
        assert(
            new Set(this.privates.map((item) => item.id)).size === this.privates.length,
            'Duplicate private company'
        )
    }
    definition(privateCompanyId: string): PrivateDefinition {
        const definition = this.privates.find((item) => item.id === privateCompanyId)
        assertExists(definition, `Unknown private company ${privateCompanyId}`)
        return definition
    }
    faceValue(privateCompanyId: string): number {
        return this.definition(privateCompanyId).faceValue
    }
    lots(state: FinancialState): AuctionLot[] {
        return this.privates
            .filter((item) => state.companies.some((company) => company.id === item.id))
            .map(({ id, name, faceValue }) => ({ id, name, price: faceValue }))
    }
    priceRange(privateCompanyId: string): { minimum: number; maximum: number } | undefined {
        const { faceValue, sale } = this.definition(privateCompanyId)
        if (sale === 'never') return undefined
        return sale ?? { minimum: Math.ceil(faceValue / 2), maximum: faceValue * 2 }
    }
    closureEffects(state: CatalogState): PrivateEffect[] {
        if (!this.phases.isAtLeast(state.phaseId, this.closurePhaseId)) return []
        return this.open(state).flatMap(({ company, definition }): PrivateEffect[] => {
            const { closure } = definition
            if (closure === 'never') return []
            if (closure && privateOwner(state, company.id)?.kind === 'player') {
                const { revenue } = closure.survivesWhilePlayerOwned
                return company.privateRevenue === revenue
                    ? []
                    : [{ kind: 'income', privateCompanyId: company.id, revenue }]
            }
            return [{ kind: 'close', privateCompanyId: company.id }]
        })
    }
    blockedBy(state: FinancialState, locationId: string): PrivateDefinition | undefined {
        return this.open(state).find(
            ({ company, definition }) =>
                definition.blocks?.locationIds.includes(locationId) &&
                (definition.blocks.until === 'closed' ||
                    privateOwner(state, company.id)?.kind !== 'company')
        )?.definition
    }
    private open(state: FinancialState) {
        return state.companies.flatMap((company) => {
            if (company.kind !== 'private' || company.closed) return []
            return [{ company, definition: this.definition(company.id) }]
        })
    }
}
