import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import {
    accept,
    canAccept,
    canWithdraw,
    isValidProposal,
    propose,
    withdraw
} from '../model/pacts.js'
import { PactTerms } from '../model/pieces.js'

// The pact's Common Actions (docs/parallel-spans.md, Common Actions): taken on the Main Line
// during the exploration span, handled by its Branching Machine State.

export type ProposePact = Type.Static<typeof ProposePact>
export const ProposePact = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ProposePact),
            playerId: Type.String(),
            common: Type.Literal(true),
            pactId: Type.Optional(Type.String()),
            terms: PactTerms
        })
    ])
)

export const ProposePactValidator = Compile(ProposePact)

export function isProposePact(action?: GameAction): action is ProposePact {
    return action?.type === ActionType.ProposePact
}

// A new proposal, or a counter to a standing one with new terms; either way the proposer has
// accepted their own terms and holds the ships they pledged.
export class HydratedProposePact
    extends HydratableAction<typeof ProposePact>
    implements ProposePact
{
    declare type: ActionType.ProposePact
    declare playerId: string
    declare common: true
    declare pactId?: string
    declare terms: PactTerms

    constructor(data: ProposePact) {
        super(data, ProposePactValidator)
    }

    isValid(state: HydratedStellarHorizonsGameState): boolean {
        return isValidProposal(state, this.playerId, this.terms, this.pactId)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid ProposePact action')
        }
        propose(state, this.playerId, this.terms, this.pactId ?? this.id, this.pactId !== undefined)
    }
}

export type AcceptPact = Type.Static<typeof AcceptPact>
export const AcceptPact = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AcceptPact),
            playerId: Type.String(),
            common: Type.Literal(true),
            pactId: Type.String(),
            revision: Type.Number(),
            metadata: Type.Optional(Type.Object({ agreed: Type.Boolean() }))
        })
    ])
)

export const AcceptPactValidator = Compile(AcceptPact)

export function isAcceptPact(action?: GameAction): action is AcceptPact {
    return action?.type === ActionType.AcceptPact
}

// Accepting the terms as they stand, by their revision. The acceptance that completes the
// agreement is Information-Revealing, so nobody can undo it.
export class HydratedAcceptPact extends HydratableAction<typeof AcceptPact> implements AcceptPact {
    declare type: ActionType.AcceptPact
    declare playerId: string
    declare common: true
    declare pactId: string
    declare revision: number
    declare metadata?: { agreed: boolean }

    constructor(data: AcceptPact) {
        super(data, AcceptPactValidator)
    }

    isValid(state: HydratedStellarHorizonsGameState): boolean {
        return canAccept(state, this.playerId, this.pactId, this.revision)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid AcceptPact action')
        }
        const agreed = accept(state, this.playerId, this.pactId)
        this.metadata = { agreed }
        if (agreed) {
            this.revealsInfo = true
        }
    }
}

export type WithdrawPact = Type.Static<typeof WithdrawPact>
export const WithdrawPact = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.WithdrawPact),
            playerId: Type.String(),
            common: Type.Literal(true),
            pactId: Type.String()
        })
    ])
)

export const WithdrawPactValidator = Compile(WithdrawPact)

export function isWithdrawPact(action?: GameAction): action is WithdrawPact {
    return action?.type === ActionType.WithdrawPact
}

// Any partner may withdraw a pact until it is agreed.
export class HydratedWithdrawPact
    extends HydratableAction<typeof WithdrawPact>
    implements WithdrawPact
{
    declare type: ActionType.WithdrawPact
    declare playerId: string
    declare common: true
    declare pactId: string

    constructor(data: WithdrawPact) {
        super(data, WithdrawPactValidator)
    }

    isValid(state: HydratedStellarHorizonsGameState): boolean {
        return canWithdraw(state, this.playerId, this.pactId)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid WithdrawPact action')
        }
        withdraw(state, this.pactId)
    }
}

export type PactAction = HydratedProposePact | HydratedAcceptPact | HydratedWithdrawPact

export function isPactAction(action: unknown): action is PactAction {
    return (
        action instanceof HydratedProposePact ||
        action instanceof HydratedAcceptPact ||
        action instanceof HydratedWithdrawPact
    )
}
