import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    getCompany,
    presidentCertificate,
    sameOwner,
    type FinancialState
} from '../finance/finance.js'
import { startCompanyAtPar } from './companyStart.js'
import type { FormationState } from './companyState.js'
import type { CompanyRules } from './companyRules.js'

const Id = Type.String({ minLength: 1 })
export const PendingPar = Type.Object(
    { companyId: Id, playerId: Id },
    { additionalProperties: false }
)
export type PendingPar = Type.Static<typeof PendingPar>
export const PendingParFields = { pendingPar: Type.Optional(PendingPar) }
export type PendingParState = { pendingPar?: PendingPar }
type ParState = FormationState & PendingParState & { machineState: string }
type AwardedParState = FinancialState &
    PendingParState & { players: readonly { playerId: string }[] }

/** Records that a player awarded a company's president's certificate must set its par. */
export function requirePar(state: AwardedParState, companyId: string, playerId: string): void {
    assert(!state.pendingPar, 'Only one par may be pending')
    state.pendingPar = { companyId, playerId }
    validatePendingPar(state)
}

export function validatePendingPar(state: AwardedParState): void {
    const pending = state.pendingPar
    if (!pending) return
    assert(
        state.players.some((player) => player.playerId === pending.playerId),
        'Unknown player for the pending par'
    )
    const company = getCompany(state, pending.companyId)
    assert(!company.started && !company.closed, 'A pending par belongs to an unstarted company')
    const certificate = presidentCertificate(state, pending.companyId)
    assert(
        certificate && sameOwner(certificate.owner, { kind: 'player', playerId: pending.playerId }),
        'The player setting the par holds the president’s certificate'
    )
}

export function parReason(
    state: ParState,
    rules: CompanyRules,
    request: { playerId: string; companyId: string; marketSpaceId: string }
): string | undefined {
    const pending = state.pendingPar
    if (pending?.playerId !== request.playerId || pending.companyId !== request.companyId)
        return 'This player has no par to set for this company.'
    if (!rules.startMarketSpaces(state, request.companyId).includes(request.marketSpaceId))
        return 'Choose an available starting price.'
    return undefined
}

export const ParCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ParCompany'),
        companyId: Type.String(),
        marketSpaceId: Type.String()
    },
    { additionalProperties: false }
)
export type ParCompany = Type.Static<typeof ParCompany>
const Validator = Compile(ParCompany)
export function isParCompany(action: GameAction): action is ParCompany {
    return (
        action instanceof HydratedParCompany ||
        (action.type === 'ParCompany' && Validator.Check(action))
    )
}
export class HydratedParCompany extends HydratableAction<typeof ParCompany> implements ParCompany {
    declare type: 'ParCompany'
    declare playerId: string
    declare companyId: string
    declare marketSpaceId: string
    readonly #rules: CompanyRules
    constructor(data: ParCompany, rules: CompanyRules) {
        super(data instanceof HydratedParCompany ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: ParState): boolean {
        return (
            this.source === ActionSource.User && parReason(state, this.#rules, this) === undefined
        )
    }
    apply(state: HydratedGameState & ParState): void {
        assert(this.isValid(state), 'Invalid par')
        startCompanyAtPar(state, this.companyId, this.marketSpaceId, {
            kind: 'player',
            playerId: this.playerId
        })
        delete state.pendingPar
    }
}

/** Holds the wrapped state until the player owed a par has set it. */
export class PendingParHandler<
    State extends HydratedGameState & ParState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (action instanceof HydratedParCompany) return action.isValid(context.gameState)
        return !context.gameState.pendingPar && this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const pending = context.gameState.pendingPar
        if (pending) return pending.playerId === playerId ? ['ParCompany'] : []
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<State>): void {
        const pending = context.gameState.pendingPar
        if (pending) context.gameState.activePlayerIds = [pending.playerId]
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedParCompany
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
