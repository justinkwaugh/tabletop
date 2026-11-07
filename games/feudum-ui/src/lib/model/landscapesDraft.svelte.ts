import {
    CollectLandscapes,
    collectLandscapesOffer,
    collectLandscapesPreview,
    type SpaceId
} from '@tabletop/feudum'
import { spaceTarget, type BoardTarget, type StagePick } from './boardOffer.js'
import { spaceLabel, type FlowPick, type FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type LandscapesValues = {
    /** R-4.3.4 Stacked: the spaces in press order. */
    spaces: readonly SpaceId[]
    /** R-4.10.2 How many sulfur collected go straight in the barrel. */
    barrel: number
}

export const LandscapesStageOrder: readonly (keyof LandscapesValues)[] = ['spaces', 'barrel']

export interface LandscapesPanel {
    readonly spaces: readonly (DraftChoice & {
        readonly spaceId: SpaceId
        readonly place: string
    })[]
    readonly barrel?: readonly DraftChoice[]
    readonly primary: TurnPrimary
}

/** R-4.3.4 The serf's landscapes under other rulers: each it may collect, or leave. */
export class LandscapesDraft extends DeciderDraft<LandscapesValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(LandscapesStageOrder, contextOf)
    }

    private input = $derived.by(() => {
        const sulfurToBarrel = this.value('barrel') ?? 0
        return {
            spaceIds: [...(this.value('spaces') ?? [])],
            ...(sulfurToBarrel > 0 ? { sulfurToBarrel } : {})
        }
    })

    private preview = $derived.by(() => {
        const context = this.contextOf()
        return context && collectLandscapesOffer(context.state, context.playerId)
            ? collectLandscapesPreview(context.state, context.playerId, this.input)
            : undefined
    })

    play: FlowPlay | undefined = $derived.by(() => {
        const { preview, input } = this
        return (
            preview &&
            playUnless(preview.refused, (maker) =>
                maker.createPlayerAction(CollectLandscapes, input)
            )
        )
    })

    private pressSpace(spaceId: SpaceId) {
        const picks = this.value('spaces') ?? []
        this.push(
            'spaces',
            picks.includes(spaceId) ? picks.filter((id) => id !== spaceId) : [...picks, spaceId]
        )
    }

    panel: LandscapesPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = context && collectLandscapesOffer(context.state, context.playerId)
        const { preview } = this
        if (!offer || !preview) {
            return undefined
        }
        const picks = this.value('spaces') ?? []
        const barrel = this.value('barrel')
        const sulfurKept = offer.spaces
            .filter(({ spaceId, resource }) => picks.includes(spaceId) && resource === 'sulfur')
            .reduce((sum, { collected }) => sum + collected.kept, 0)
        const mostInBarrel = Math.min(sulfurKept, offer.sulfurToBarrel)
        return {
            spaces: offer.spaces.map(({ spaceId, collected }) => ({
                spaceId,
                place: spaceLabel(spaceId),
                ...draftChoice(
                    `collect ${collected.kept} · ${collected.paid} to the ruler`,
                    picks.includes(spaceId),
                    () => {
                        this.pressSpace(spaceId)
                    }
                ),
                lights: () => [spaceTarget(spaceId)]
            })),
            ...(mostInBarrel > 0
                ? {
                      barrel: Array.from({ length: mostInBarrel + 1 }, (_, count) =>
                          draftChoice(
                              count === 0 ? 'Keep it all' : `${count} into the barrel`,
                              barrel === count,
                              () => {
                                  this.set('barrel', count)
                              }
                          )
                      )
                  }
                : {}),
            primary: {
                label: picks.length > 0 ? `Collect ${picks.length}` : 'Leave all',
                enabled: this.play !== undefined
            }
        }
    })

    get pick(): StagePick | undefined {
        const context = this.contextOf()
        const offer = context && collectLandscapesOffer(context.state, context.playerId)
        return offer
            ? {
                  targets: offer.spaces.map(({ spaceId }) => ({ target: spaceTarget(spaceId) })),
                  picked: (this.value('spaces') ?? []).map(spaceTarget)
              }
            : undefined
    }

    pickOf(target: BoardTarget): FlowPick | undefined {
        const spaceId = this.panel?.spaces.find(
            (row) => spaceTarget(row.spaceId) === target
        )?.spaceId
        return spaceId
            ? {
                  target,
                  press: () => {
                      this.pressSpace(spaceId)
                  }
              }
            : undefined
    }
}
