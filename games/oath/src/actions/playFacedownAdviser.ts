import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { discardRegionFor, HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { isIrreversible } from '../util/powerDoorway.js'
import { PowerChoice } from '../util/powerChoice.js'
import { ActionType } from '../definition/actions.js'
import { Region } from '../model/oathEnums.js'
import { ConspiracyPlay } from '../model/conspiracy.js'
import { playShowsCard, SearchPlay } from './searchResolve.js'
import { playCard, reasonCannotPlaceCard, reasonCannotPlayCard } from '../util/cardPlay.js'
import { commitHiddenOutputs, revealForPlay } from '../util/hiddenInputs.js'
import { discardWitnesses } from '../util/knowledge.js'
import { regionOfPawn } from '../powers/vocabulary.js'
import { cardPowers } from '../data/cardPowers.js'
import { effectFor, type ModifierHooks } from '../powers/registry.js'
import {
    discardTargetOf,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    runAfter,
    type ActiveModifier
} from '../util/modifiers.js'
import { modifierPayment, reasonCannotPayInAll, secretPayment } from '../util/actionPayment.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

export type PlayFacedownAdviserMetadata = Type.Static<typeof PlayFacedownAdviserMetadata>
export const PlayFacedownAdviserMetadata = Type.Object({
    /** R-7.3.3 — after this play's own discards. */
    ...PowerOutcome.properties,
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    }),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor })),
    // R-10.5: the discard pile is the next region's, not the pawn's, unless Bracken named one.
    discardPileRegion: Type.Enum(Region),
    /** Bracken */
    discardToBottom: Type.Optional(Type.Boolean()),
    /** Cracked Horn */
    discardToWorldDeck: Type.Optional(Type.Boolean()),
    /** R-9.4 — only when the play shows it. */
    playedCardId: Type.Optional(Type.String()),
    favorGained: Type.Number(),
    /** Book of Records */
    secretsGained: Type.Optional(Type.Number()),
    /** R-7.4 — the cards whose Search modifiers applied to this play. */
    modifiers: Type.Optional(Type.Array(Type.String())),
    /** R-7.4 (Wild Cry) */
    modifierNotes: Type.Optional(Type.Array(Type.String())),
    whenPlayed: Type.Optional(Type.String()),
    endsActPhase: Type.Optional(Type.Boolean()),
    sitePower: Type.Optional(Type.String())
})

export type PlayFacedownAdviser = Type.Static<typeof PlayFacedownAdviser>
export const PlayFacedownAdviser = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayFacedownAdviser),
            playerId: Type.String(),
            /** R-9.4 — secret until the play shows it. */
            cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
            // R-6.1 plays the adviser faceup, so SearchPlay.Adviser means faceup in place.
            play: Type.Enum(SearchPlay),
            conspiracy: Type.Optional(ConspiracyPlay),
            choices: Type.Optional(Type.Array(PowerChoice, { maxItems: 16 })),
            /** R-6.1, R-7.6.4 — a flipped limiter that leaves too many advisers. */
            discardedAdviserCardIds: Type.Optional(
                Visibility.protect(Type.Array(Type.String(), { maxItems: 8 }), {
                    policy: Visibility.Policy.Actor
                })
            ),
            /** R-5.1.4.I — the People's Favor's holder may play to another site in their region. */
            toSiteId: Type.Optional(Type.String()),
            /** R-5.1.4.I, R-11.10 — a denizen discarded before the site play. */
            discardFirstCardId: Type.Optional(Type.String()),
            /** R-6.1 — "(Restrictions and modifiers apply.)": Search modifiers, declared with the play. */
            modifiers: ModifierUses,
            metadata: Type.Optional(PlayFacedownAdviserMetadata)
        })
    ])
)

export const PlayFacedownAdviserValidator = Compile(PlayFacedownAdviser)

export function isPlayFacedownAdviser(action?: GameAction): action is PlayFacedownAdviser {
    return action?.type === ActionType.PlayFacedownAdviser
}

export class HydratedPlayFacedownAdviser
    extends HydratableAction<typeof PlayFacedownAdviser>
    implements PlayFacedownAdviser
{
    declare type: ActionType.PlayFacedownAdviser
    declare playerId: string
    declare cardId: string
    declare play: SearchPlay
    declare conspiracy?: ConspiracyPlay
    declare choices?: PowerChoice[]
    declare discardedAdviserCardIds?: string[]
    declare toSiteId?: string
    declare discardFirstCardId?: string
    declare modifiers?: ModifierUse[]
    declare metadata?: PlayFacedownAdviserMetadata

    constructor(data: PlayFacedownAdviser) {
        super(data, PlayFacedownAdviserValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = discardWitnesses(state)
        const player = state.getPlayerState(this.playerId)
        const reason = HydratedPlayFacedownAdviser.reasonCannotPlay(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot play facedown adviser: ${reason}`)
        }
        const reveal = revealForPlay(state, this)
        const { active } = HydratedPlayFacedownAdviser.playModifiers(
            state,
            this.playerId,
            this.play,
            this.modifiers
        )

        const region = regionOfPawn(state, this.playerId)

        // R-7.1.2, R-7.4 — paid at declaration.
        payModifierCosts(state, this.playerId, active)
        const discardTarget = discardTargetOf(state, this.playerId, active)

        // Removed first so that replaying it faceup into the same slot finds room on the board.
        player.removeAdviser(this.cardId)

        // R-6.1: "as if you searched" (R-5.1.4), faceup.
        const played = playCard(state, this.playerId, this.cardId, this.play, region, {
            faceUp: true,
            conspiracy: this.conspiracy,
            choices: this.choices,
            discardedAdviserCardIds: this.discardedAdviserCardIds,
            reveal,
            toSiteId: this.toSiteId,
            discardFirstCardId: this.discardFirstCardId,
            carried: active,
            discardTarget
        })
        const playedCardId = playShowsCard(this.play, true) ? this.cardId : undefined
        const after = runAfter(state, this.playerId, active, { playedCardId, playedTo: this.play })

        this.metadata = {
            ...played.outcome,
            reveal,
            discardedCardIds: played.discarded,
            discardPileRegion: discardTarget?.region ?? discardRegionFor(region),
            discardToBottom: discardTarget?.bottom || undefined,
            discardToWorldDeck: discardTarget?.worldDeck || undefined,
            playedCardId,
            favorGained: played.favorGained,
            secretsGained: played.secretsGained || undefined,
            modifiers: active.length > 0 ? active.map((m) => m.power.cardId) : undefined,
            modifierNotes: after.notes.length > 0 ? after.notes : undefined,
            whenPlayed: played.whenPlayed,
            sitePower: played.sitePower,
            endsActPhase: played.endsActPhase
        }

        // R-X.3 — the vault is never rolled back, and a card shown to everyone cannot be unseen.
        this.revealsInfo =
            this.metadata.discardedCardIds.length > 0 ||
            this.metadata.playedCardId !== undefined ||
            isIrreversible(this.metadata) ||
            reveal !== undefined
        commitHiddenOutputs(this, state, witnesses)
    }

    static reasonCannotPlay(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            cardId: string
            play: SearchPlay
            conspiracy?: ConspiracyPlay
            choices?: readonly PowerChoice[]
            discardedAdviserCardIds?: readonly string[]
            toSiteId?: string
            discardFirstCardId?: string
            modifiers?: readonly ModifierUse[]
        }
    ): string | undefined {
        const notFacedown = HydratedPlayFacedownAdviser.reasonNotFacedown(
            state,
            playerId,
            choice.cardId
        )
        if (notFacedown) return notFacedown
        const { reason, active } = HydratedPlayFacedownAdviser.playModifiers(
            state,
            playerId,
            choice.play,
            choice.modifiers
        )
        if (reason) return reason
        return (
            reasonCannotPlayCard(state, playerId, choice.cardId, choice.play, {
                faceUp: true,
                conspiracy: choice.conspiracy,
                fromAdvisers: true,
                choices: choice.choices,
                discardedAdviserCardIds: choice.discardedAdviserCardIds,
                toSiteId: choice.toSiteId,
                discardFirstCardId: choice.discardFirstCardId,
                carried: active
            }) ??
            reasonCannotPayInAll(state, playerId, [
                modifierPayment(active),
                // R-5.1.4.IV — the Conspiracy's take burns a secret.
                secretPayment(choice.conspiracy ? 1 : 0)
            ])
        )
    }

    /** R-6.1 — where the adviser may go, judged apart from its When Played choices. */
    static reasonCannotPlace(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            cardId: string
            play: SearchPlay
            discardedAdviserCardIds?: readonly string[]
            toSiteId?: string
            discardFirstCardId?: string
            modifiers?: readonly ModifierUse[]
        }
    ): string | undefined {
        const notFacedown = HydratedPlayFacedownAdviser.reasonNotFacedown(
            state,
            playerId,
            choice.cardId
        )
        if (notFacedown) return notFacedown
        const { reason, active } = HydratedPlayFacedownAdviser.playModifiers(
            state,
            playerId,
            choice.play,
            choice.modifiers
        )
        return (
            reason ??
            reasonCannotPlaceCard(state, playerId, choice.cardId, choice.play, {
                faceUp: true,
                fromAdvisers: true,
                discardedAdviserCardIds: choice.discardedAdviserCardIds,
                toSiteId: choice.toSiteId,
                discardFirstCardId: choice.discardFirstCardId,
                carried: active
            })
        )
    }

    /**
     * R-6.1 — "as if you searched (5.1.4). (Restrictions and modifiers apply.)": the declared
     * Search modifiers and the holder's mandatory ones (R-7.4.1) that act on the play itself.
     */
    static playModifiers(
        state: HydratedOathGameState,
        playerId: string,
        play: SearchPlay,
        uses: readonly ModifierUse[] | undefined
    ): { reason?: string; active: ActiveModifier[] } {
        // R-X.4 — a game created before this revision played a facedown adviser with no modifier.
        if (!isAtLeastOathRevision(state, OathRevision.CostsAndFacedownModifiers)) {
            return (uses?.length ?? 0) > 0
                ? {
                      reason: 'in a game created before revision 2, no modifier applies to a facedown adviser’s play',
                      active: []
                  }
                : { active: [] }
        }
        for (const use of uses ?? []) {
            const power = cardPowers(use.cardId)[use.powerIndex]
            const hooks = power ? effectFor(power)?.modifier : undefined
            if (hooks && HydratedPlayFacedownAdviser.changesTheDraw(hooks)) {
                return {
                    reason: `${use.cardId} changes a Search's draw, and this play draws nothing`,
                    active: []
                }
            }
        }
        const resolved = resolveModifiers(state, playerId, ActionType.Search, uses, {
            facedownAdviserPlay: true,
            playedTo: play
        })
        if (resolved.reason) return resolved
        return {
            active: resolved.active.filter(
                (m) => !m.mandatory || HydratedPlayFacedownAdviser.actsOnPlay(m.hooks, play)
            )
        }
    }

    private static changesTheDraw(hooks: ModifierHooks): boolean {
        return (
            hooks.supplyCost !== undefined ||
            hooks.drawCount !== undefined ||
            hooks.drawRegion !== undefined ||
            hooks.drawsFromBottom === true ||
            hooks.revealsDraw === true ||
            hooks.secondPlay === true ||
            hooks.forbids !== undefined
        )
    }

    private static actsOnPlay(hooks: ModifierHooks, play: SearchPlay): boolean {
        const atSite =
            hooks.sitePlayGainsSecret === true ||
            hooks.playAnywhere !== undefined ||
            hooks.discardFirstAtSitePlay === true
        return (
            (atSite && play === SearchPlay.Site) ||
            hooks.discardTo !== undefined ||
            hooks.after !== undefined
        )
    }

    private static reasonNotFacedown(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string
    ): string | undefined {
        const adviser = state.getPlayerState(playerId).knownAdviser(cardId)
        if (!adviser) {
            return `${cardId} is not one of your advisers`
        }
        // R-6.1 names facedown advisers only.
        if (adviser.faceUp) {
            return `${cardId} is already faceup`
        }
        return undefined
    }

    static legalCards(state: HydratedOathGameState, playerId: string): string[] {
        const player = state.getPlayerState(playerId)
        if (!player.hasFacedownAdvisers()) return []
        return player
            .knownAdvisers()
            .filter((a) => !a.faceUp)
            .map((a) => a.cardId)
            .filter(
                (cardId) =>
                    // R-6.1 always offers discarding, so a card with nowhere to go faceup is still legal.
                    HydratedPlayFacedownAdviser.reasonCannotPlay(state, playerId, {
                        cardId,
                        play: SearchPlay.Discard
                    }) === undefined
            )
    }

    static canDoPlayFacedownAdviser(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedPlayFacedownAdviser.legalCards(state, playerId).length > 0
    }
}
