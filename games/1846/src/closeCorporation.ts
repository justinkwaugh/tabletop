import { Market1846 } from './stock.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type MachineStateHandler
} from '@tabletop/common'
import { CompanyClosure, closeShareCompany } from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'
import { RevenueMarker } from './revenueMarkers.js'

export function corporationAwaitingClosure(
    state: HydratedEighteenFortySixState
): string | undefined {
    return state.companies.find(
        (company) =>
            company.kind === 'major' &&
            company.started &&
            !company.closed &&
            Market1846.companySpace(state.stockMarket, company.id).price === 0
    )?.id
}

export const RailroadClosure = Type.Object(
    { ...CompanyClosure.properties, removedRevenueMarkers: Type.Array(RevenueMarker) },
    { additionalProperties: false }
)
export type RailroadClosure = Type.Static<typeof RailroadClosure>

const ClosureFields = Type.Object(
    {
        type: Type.Literal('CloseCorporation'),
        source: Type.Literal(ActionSource.System),
        companyId: Type.String(),
        metadata: Type.Optional(RailroadClosure)
    },
    { additionalProperties: false }
)
export const CloseCorporation: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof ClosureFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ClosureFields.properties },
    { additionalProperties: false }
)
export const CloseCorporationValidator: ReturnType<typeof Compile<typeof CloseCorporation>> =
    Compile(CloseCorporation)
export class CloseCorporationAction extends HydratableAction<typeof CloseCorporation> {
    declare companyId: string
    declare metadata?: Type.Static<typeof CloseCorporation>['metadata']
    constructor(data: Type.Static<typeof CloseCorporation>) {
        super(data, CloseCorporationValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                corporationAwaitingClosure(state) === this.companyId,
            'Only the next zero-price corporation can close'
        )
        this.metadata = closeRailroad(state, this.companyId)
    }
}

export const corporationClosureHandler: Omit<
    MachineStateHandler<CloseCorporationAction, HydratedEighteenFortySixState>,
    'onAction'
> = {
    enter(context) {
        const companyId = corporationAwaitingClosure(context.gameState)
        assertExists(companyId, 'Closure requires a zero-price corporation')
        context.addSystemAction(CloseCorporation, { companyId })
    },
    validActionsForPlayer() {
        return []
    },
    isValidAction(action, { gameState }) {
        return (
            action instanceof CloseCorporationAction &&
            action.source === ActionSource.System &&
            action.companyId === corporationAwaitingClosure(gameState)
        )
    }
}

export function closeRailroad(
    state: HydratedEighteenFortySixState,
    companyId: string
): RailroadClosure {
    const removedRevenueMarkers = state.revenueMarkers.filter(
        (marker) => marker.companyId === companyId
    )
    const closure = closeShareCompany(state, companyId, 'removed')
    if (state.steamboat?.companyId === companyId) delete state.steamboat
    state.revenueMarkers = state.revenueMarkers.filter((marker) => marker.companyId !== companyId)
    return { ...closure, removedRevenueMarkers }
}
