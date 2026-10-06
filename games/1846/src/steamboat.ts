import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, PlayerAction, HydratableAction, assert } from '@tabletop/common'
import { privateOwner, type FinancialState } from '@tabletop/18xx'
import { PortSymbols } from './map.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const SteamboatAssignment = Type.Object(
    { companyId: Type.String(), locationId: Type.String() },
    { additionalProperties: false }
)
export type SteamboatAssignment = Type.Static<typeof SteamboatAssignment>
export const SteamboatFields = { steamboat: Type.Optional(SteamboatAssignment) }
export type SteamboatState = Type.Static<Type.TObject<typeof SteamboatFields>>

export function steamboatOwner(state: FinancialState): string | undefined {
    if (!state.companies.some((company) => company.id === 'SC' && !company.closed)) return
    const owner = privateOwner(state, 'SC')
    return owner?.kind === 'player' ? owner.playerId : undefined
}
export function steamboatCompanies(state: FinancialState): string[] {
    return state.companies
        .filter(
            (company) =>
                !company.closed &&
                (company.kind === 'minor'
                    ? company.started
                    : company.kind === 'major' && company.floated)
        )
        .map((company) => company.id)
}
export const AssignSteamboat = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AssignSteamboat'),
        source: Type.Literal(ActionSource.User),
        assignment: Type.Optional(SteamboatAssignment),
        metadata: Type.Optional(
            Type.Object(
                {
                    assignment: Type.Optional(SteamboatAssignment),
                    skipped: Type.Boolean()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export const AssignSteamboatValidator = Compile(AssignSteamboat)
export class AssignSteamboatAction extends HydratableAction<typeof AssignSteamboat> {
    declare playerId: string
    declare assignment?: Type.Static<typeof SteamboatAssignment>
    declare metadata?: Type.Static<typeof AssignSteamboat>['metadata']
    constructor(data: Type.Static<typeof AssignSteamboat>) {
        super(data, AssignSteamboatValidator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === 'AssigningSteamboat' &&
            this.playerId === steamboatOwner(state) &&
            state.activePlayerIds.includes(this.playerId) &&
            (!this.assignment ||
                (steamboatCompanies(state).includes(this.assignment.companyId) &&
                    Object.hasOwn(PortSymbols, this.assignment.locationId)))
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.isValid(state),
            'Only the Steamboat owner may assign a railroad and port during private income'
        )
        if (this.assignment) state.steamboat = { ...this.assignment }
        this.metadata = {
            ...(state.steamboat ? { assignment: { ...state.steamboat } } : {}),
            skipped: !this.assignment
        }
        state.activePlayerIds = []
    }
}
