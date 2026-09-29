import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { ShownPlayerPolicy } from '../model/question.js'
import { canUseGrandScepter, holdsGrandScepter, reliquarySlot } from '../util/imperial.js'
import { peekRelicInVault } from '../util/hiddenInputs.js'

/** R-6.1, R-9.4, R-6.6.1 */
export enum LetPeekSubjectKind {
    /** R-6.1, R-9.4 — "you can let any other players peek at them". */
    Adviser = 'adviser',
    /** R-6.6.1 — "You can let them peek at any relics in the Imperial Reliquary." */
    Reliquary = 'reliquary'
}

export type LetPeekSubject = Type.Static<typeof LetPeekSubject>
export const LetPeekSubject = Type.Union([
    Type.Object({
        kind: Type.Literal(LetPeekSubjectKind.Adviser),
        cardId: Visibility.protect(Type.String(), {
            policy: Visibility.Policy.anyOf(Visibility.Policy.Actor, ShownPlayerPolicy)
        })
    }),
    Type.Object({
        kind: Type.Literal(LetPeekSubjectKind.Reliquary),
        /** R-2.3 */
        slotId: Type.String()
    })
])

export type LetPeekMetadata = Type.Static<typeof LetPeekMetadata>
export const LetPeekMetadata = Type.Object({
    /** R-6.6.1 — the Exile sees the relic; the Scepter's holder does not by showing it. */
    relicCardId: Visibility.protect(Type.String(), { policy: ShownPlayerPolicy })
})

export type LetPeek = Type.Static<typeof LetPeek>
export const LetPeek = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LetPeek),
            playerId: Type.String(),
            /** R-9.4 — "at any time", so it is never a turn's action. */
            outOfTurn: Type.Literal(true),
            sequenced: Type.Literal(true),
            toPlayerId: Type.String(),
            subject: LetPeekSubject,
            metadata: Type.Optional(LetPeekMetadata)
        })
    ])
)

export const LetPeekValidator = Compile(LetPeek)

export function isLetPeek(action?: GameAction): action is LetPeek {
    return action?.type === ActionType.LetPeek
}

export class HydratedLetPeek extends HydratableAction<typeof LetPeek> implements LetPeek {
    declare type: ActionType.LetPeek
    declare playerId: string
    declare outOfTurn: true
    declare sequenced: true
    declare toPlayerId: string
    declare subject: LetPeekSubject
    declare metadata?: LetPeekMetadata

    constructor(data: LetPeek) {
        super(data, LetPeekValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        const reason = HydratedLetPeek.reasonCannotLetPeek(
            state,
            this.playerId,
            this.toPlayerId,
            this.subject
        )
        if (reason) {
            throw Error(`Cannot let ${this.toPlayerId} peek: ${reason}`)
        }
        if (this.subject.kind === LetPeekSubjectKind.Reliquary) {
            const relicCardId = peekRelicInVault(state, this.subject.slotId)
            state.getPlayerState(this.toPlayerId).recordPeek(this.subject.slotId, relicCardId)
            this.metadata = { relicCardId }
            return
        }
        state.getPlayerState(this.playerId).markShown(this.subject.cardId, this.toPlayerId)
    }

    static reasonCannotLetPeek(
        state: HydratedOathGameState,
        playerId: string,
        toPlayerId: string,
        subject: LetPeekSubject
    ): string | undefined {
        const pending = HydratedLetPeek.reasonCannotShowNow(state, playerId)
        if (pending) return pending
        const shown = state.findPlayerState(toPlayerId)
        if (!shown) return `no such player ${toPlayerId}`
        if (toPlayerId === playerId) return 'you can peek at your own cards without showing them'

        if (subject.kind === LetPeekSubjectKind.Adviser) {
            const adviser = state.getPlayerState(playerId).knownAdviser(subject.cardId)
            if (!adviser || adviser.faceUp) return `${subject.cardId} is not your facedown adviser`
            return undefined
        }

        if (!holdsGrandScepter(state, playerId)) {
            return 'letting an Exile peek at the Imperial Reliquary requires the Grand Scepter'
        }
        if (!canUseGrandScepter(state, playerId)) {
            return 'the Grand Scepter cannot be used on the turn it was taken'
        }
        if (shown.status !== PlayerStatus.Exile) {
            return `${toPlayerId} is a ${shown.status}, not an Exile`
        }
        if (!reliquarySlot(state, subject.slotId)) {
            return `${subject.slotId} is not an occupied space in the Imperial Reliquary`
        }
        return undefined
    }

    /** R-9.4-H1 — any time the game is not waiting on this player, their own Act Phase included. */
    static reasonCannotShowNow(state: HydratedOathGameState, playerId: string): string | undefined {
        if (state.winningPlayerIds.length > 0) return 'the game is over'
        if (
            state.activePlayerIds.includes(playerId) &&
            state.machineState !== MachineState.ActPhase
        ) {
            return 'the game is waiting on your decision'
        }
        return undefined
    }

    /** The subjects a player may show, each paired with the players who may see it. */
    static legalShows(
        state: HydratedOathGameState,
        playerId: string
    ): { subject: LetPeekSubject; toPlayerIds: string[] }[] {
        const player = state.getPlayerState(playerId)
        const subjects: LetPeekSubject[] = [
            ...player
                .facedownAdviserIds()
                .map((cardId) => ({ kind: LetPeekSubjectKind.Adviser as const, cardId })),
            ...state.reliquarySlots().map((slot) => ({
                kind: LetPeekSubjectKind.Reliquary as const,
                slotId: slot.slotId
            }))
        ]
        return subjects
            .map((subject) => ({
                subject,
                toPlayerIds: state.players
                    .map((other) => other.playerId)
                    .filter(
                        (toPlayerId) =>
                            HydratedLetPeek.reasonCannotLetPeek(
                                state,
                                playerId,
                                toPlayerId,
                                subject
                            ) === undefined
                    )
            }))
            .filter((show) => show.toPlayerIds.length > 0)
    }

    static canDoLetPeek(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedLetPeek.legalShows(state, playerId).length > 0
    }
}
