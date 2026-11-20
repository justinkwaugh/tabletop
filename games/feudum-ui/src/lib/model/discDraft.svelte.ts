import {
    GuildById,
    PlaceDisc,
    placeDiscOffer,
    PlayerDiscRoles,
    printedSpaceNumber,
    reasonPlaceDiscRefused,
    type PlaceDiscOffer
} from '@tabletop/feudum'
import { discTarget, type BoardTarget } from './boardOffer.js'
import type { FlowPick, FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type DiscValues = {
    /** R-4.7, R-4.9-H1, R-3.7.5 Optional, since discs are shared: false keeps the disc. */
    place: boolean
}

export const DiscStageOrder: readonly (keyof DiscValues)[] = ['place']

export interface DiscPanel {
    readonly line: string
    /** R-4.9.2 The space a service disc takes, and the penalty it covers. */
    readonly covers?: string
    /** R-1.1 "2/3 discs free" */
    readonly freeDiscs: string
    readonly place?: DraftChoice
    readonly keep: DraftChoice
    /** R-X.2 Only once a placement that can't be undone is staged. */
    readonly primary?: TurnPrimary
}

/** R-4.7, R-4.9-H1, R-3.7.5 One question, two buttons; a step that draws stages (R-X.2). */
export class DiscDraft extends DeciderDraft<DiscValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(DiscStageOrder, contextOf)
    }

    private offer: PlaceDiscOffer | undefined = $derived.by(() => {
        const context = this.contextOf()
        return context && placeDiscOffer(context.state, context.playerId)
    })

    private refusal: string | undefined = $derived.by(() => {
        const context = this.contextOf()
        return context && reasonPlaceDiscRefused(context.state, context.playerId, true)
    })

    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const place = this.value('place')
        if (!context || place === undefined) {
            return undefined
        }
        return playUnless(
            reasonPlaceDiscRefused(context.state, context.playerId, place),
            (maker) => maker.createPlayerAction(PlaceDisc, { place }),
            place && this.offer?.revealsInfo ? { revealsInfo: true } : undefined
        )
    })

    /** The press that completes an undoable Action sends at once (contract: Pick conventions). */
    sendsNow: FlowPlay | undefined = $derived.by(() =>
        this.play && sendsOnPress(this, this.play) ? this.play : undefined
    )

    private pressPlace = () => {
        if (this.value('place')) {
            this.clearFrom('place')
        } else {
            this.set('place', true)
        }
    }

    /** R-4.7, R-4.9.1, R-3.7.5 The place the disc would go to: a press there is the placement. */
    pickOf(target: BoardTarget): FlowPick | undefined {
        const offer = this.offer
        return offer && !this.refusal && discTarget(offer) === target
            ? { target, press: this.pressPlace }
            : undefined
    }

    panel: DiscPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = this.offer
        if (!context || !offer) {
            return undefined
        }
        const placing = this.value('place') === true
        const free = context.state.freeDiscs(context.playerId)
        return {
            line: DiscDraft.questionOf(offer),
            ...(offer.disc === 'military'
                ? {
                      covers: `Space ${printedSpaceNumber(offer.space)} · covers −${Math.abs(offer.penalty)}`
                  }
                : {}),
            freeDiscs: `${free}/${PlayerDiscRoles.shared} discs free`,
            ...(this.refusal
                ? {}
                : {
                      place: {
                          ...draftChoice(DiscDraft.placementOf(offer), placing, this.pressPlace),
                          ...(offer.disc === 'voyage' && offer.advances
                              ? { shown: 'Advance' }
                              : {}),
                          lights: () => [discTarget(offer)]
                      }
                  }),
            keep: {
                ...draftChoice('Keep the disc', false, () => {
                    this.set('place', false)
                }),
                shown: 'Keep'
            },
            ...(placing && this.play
                ? {
                      primary: {
                          label: primaryLabel(DiscDraft.placementOf(offer), this.play),
                          enabled: true
                      }
                  }
                : {})
        }
    })

    private static writWord(count: number): string {
        return count === 1 ? 'writ' : 'writs'
    }

    private static questionOf(offer: PlaceDiscOffer): string {
        switch (offer.disc) {
            case 'reeve': {
                return `Reeve in ${GuildById[offer.guildId].name}?`
            }
            case 'military': {
                return 'Service disc?'
            }
            case 'voyage': {
                const space = printedSpaceNumber(offer.space)
                if (!offer.advances) {
                    return `Voyage space ${space}?`
                }
                return offer.draw > 0
                    ? primaryLabel(
                          `To ${space}? +${offer.draw} ${DiscDraft.writWord(offer.draw)}`,
                          offer
                      )
                    : `To ${space}?`
            }
        }
    }

    /** R-3.7-H1 The placement's button: a disc on the track advances. */
    private static placementOf(offer: PlaceDiscOffer): string {
        return offer.disc === 'voyage' && offer.advances
            ? `Advance to ${printedSpaceNumber(offer.space)}`
            : 'Place'
    }
}
