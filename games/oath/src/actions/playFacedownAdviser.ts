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
import {
    playCard,
    playShowsCard,
    reasonCannotPlaceCard,
    reasonCannotPlayCard,
    SearchPlay
} from './searchResolve.js'
import { commitHiddenOutputs, revealForPlay } from '../util/hiddenInputs.js'
import { regionOfPawn } from '../powers/vocabulary.js'

export type PlayFacedownAdviserMetadata = Type.Static<typeof PlayFacedownAdviserMetadata>
export const PlayFacedownAdviserMetadata = Type.Object({
    /** R-7.3.3 — after this play's own discards. */
    ...PowerOutcome.properties,
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    }),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor })),
    // R-10.5: the discard pile is the next region's, not the pawn's.
    discardPileRegion: Type.Enum(Region),
    /** R-9.4 — only when the play shows it. */
    playedCardId: Type.Optional(Type.String()),
    favorGained: Type.Number(),
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
    declare metadata?: PlayFacedownAdviserMetadata

    constructor(data: PlayFacedownAdviser) {
        super(data, PlayFacedownAdviserValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const reason = HydratedPlayFacedownAdviser.reasonCannotPlay(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot play facedown adviser: ${reason}`)
        }
        const reveal = revealForPlay(state, this)

        const region = regionOfPawn(state, this.playerId)

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
            discardFirstCardId: this.discardFirstCardId
        })

        this.metadata = {
            ...played.outcome,
            reveal,
            discardedCardIds: played.discarded,
            discardPileRegion: discardRegionFor(region),
            playedCardId: playShowsCard(this.play, true) ? this.cardId : undefined,
            favorGained: played.favorGained,
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
        commitHiddenOutputs(this, state)
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
        }
    ): string | undefined {
        return (
            HydratedPlayFacedownAdviser.reasonNotFacedown(state, playerId, choice.cardId) ??
            reasonCannotPlayCard(state, playerId, choice.cardId, choice.play, {
                faceUp: true,
                conspiracy: choice.conspiracy,
                fromAdvisers: true,
                choices: choice.choices,
                discardedAdviserCardIds: choice.discardedAdviserCardIds,
                toSiteId: choice.toSiteId,
                discardFirstCardId: choice.discardFirstCardId
            })
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
        }
    ): string | undefined {
        return (
            HydratedPlayFacedownAdviser.reasonNotFacedown(state, playerId, choice.cardId) ??
            reasonCannotPlaceCard(state, playerId, choice.cardId, choice.play, {
                faceUp: true,
                fromAdvisers: true,
                discardedAdviserCardIds: choice.discardedAdviserCardIds,
                toSiteId: choice.toSiteId,
                discardFirstCardId: choice.discardFirstCardId
            })
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
