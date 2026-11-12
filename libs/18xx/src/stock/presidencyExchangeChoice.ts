import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { sameOwner, type FinancialState } from '../finance/finance.js'
import type { PresidencyChange, PresidencyExchangeState } from './presidency.js'

type ExchangeState = FinancialState & PresidencyExchangeState

/** The presidency change whose outgoing president chooses next, if any. */
export function pendingPresidencyExchange(state: PresidencyExchangeState) {
    return state.presidencyExchanges?.[0]
}

/** The player choosing the certificates for a pending exchange: its outgoing president. */
export function presidencyExchangeChooser(change: PresidencyChange): string {
    assert(change.previous.kind === 'player', 'A player chooses a presidency exchange')
    return change.previous.playerId
}

/** Every set of certificates the outgoing president may take, the exchanged set first. */
export function presidencyExchangeOptions(change: PresidencyChange): string[][] {
    return [change.exchangedCertificateIds, ...(change.alternatives ?? [])]
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id) => b.includes(id))

export function presidencyExchangeReason(
    state: PresidencyExchangeState,
    request: { playerId: string; companyId: string; certificateIds: readonly string[] }
): string | undefined {
    const pending = pendingPresidencyExchange(state)
    if (
        !pending ||
        pending.companyId !== request.companyId ||
        presidencyExchangeChooser(pending) !== request.playerId
    )
        return 'This player has no presidency exchange to choose.'
    if (!presidencyExchangeOptions(pending).some((ids) => sameIds(ids, request.certificateIds)))
        return 'Choose certificates the new president holds for the exchange.'
    return undefined
}

/**
 * Settles the outgoing president's choice: certificates other than those exchanged go back
 * the other way, and the next waiting exchange, if any, comes up.
 */
export function choosePresidencyExchange(state: ExchangeState, certificateIds: readonly string[]) {
    const [pending, ...rest] = state.presidencyExchanges ?? []
    assert(pending, 'A presidency exchange is pending')
    if (!sameIds(pending.exchangedCertificateIds, certificateIds)) {
        const move = (ids: readonly string[], from: PresidencyChange['next'], to: typeof from) => {
            for (const id of ids) {
                const certificate = state.certificates.find((entry) => entry.id === id)
                assert(
                    certificate && sameOwner(certificate.owner, from),
                    'Exchanged certificates stay with their holder until the choice'
                )
                certificate.owner = to
            }
        }
        move(pending.exchangedCertificateIds, pending.previous, pending.next)
        move(certificateIds, pending.next, pending.previous)
    }
    if (rest.length) state.presidencyExchanges = rest
    else delete state.presidencyExchanges
}

export const ChoosePresidencyExchange = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ChoosePresidencyExchange'),
        companyId: Type.String(),
        certificateIds: Type.Array(Type.String(), { minItems: 1 })
    },
    { additionalProperties: false }
)
export type ChoosePresidencyExchange = Type.Static<typeof ChoosePresidencyExchange>
const Validator = Compile(ChoosePresidencyExchange)
export function isChoosePresidencyExchange(action: GameAction): action is ChoosePresidencyExchange {
    return (
        action instanceof HydratedChoosePresidencyExchange ||
        (action.type === 'ChoosePresidencyExchange' && Validator.Check(action))
    )
}
export class HydratedChoosePresidencyExchange
    extends HydratableAction<typeof ChoosePresidencyExchange>
    implements ChoosePresidencyExchange
{
    declare type: 'ChoosePresidencyExchange'
    declare playerId: string
    declare companyId: string
    declare certificateIds: string[]
    constructor(data: ChoosePresidencyExchange) {
        super(data instanceof HydratedChoosePresidencyExchange ? data.dehydrate() : data, Validator)
    }
    isValid(state: PresidencyExchangeState): boolean {
        return (
            this.source === ActionSource.User && presidencyExchangeReason(state, this) === undefined
        )
    }
    apply(state: HydratedGameState & ExchangeState): void {
        assert(this.isValid(state), 'Invalid presidency exchange choice')
        choosePresidencyExchange(state, this.certificateIds)
    }
}

/**
 * Holds the wrapped state while an outgoing president chooses the certificates they take for
 * the president's certificate; play resumes where it stood (1849 §9.5).
 */
export class PresidencyExchangeHandler<
    State extends HydratedGameState & ExchangeState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (action instanceof HydratedChoosePresidencyExchange)
            return action.isValid(context.gameState)
        return (
            !pendingPresidencyExchange(context.gameState) &&
            this.handler.isValidAction(action, context)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const pending = pendingPresidencyExchange(context.gameState)
        if (pending)
            return presidencyExchangeChooser(pending) === playerId
                ? ['ChoosePresidencyExchange']
                : []
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<State>): void {
        const pending = pendingPresidencyExchange(context.gameState)
        if (pending) context.gameState.activePlayerIds = [presidencyExchangeChooser(pending)]
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (action instanceof HydratedChoosePresidencyExchange)
            return context.gameState.machineState
        return this.handler.onAction(action, context)
    }
}
