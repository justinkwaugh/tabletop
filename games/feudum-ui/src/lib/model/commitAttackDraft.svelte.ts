import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    canCoverWithWildTiles,
    CommitAttack,
    commitAttackOffer,
    commitAttackPreview,
    goodsShort,
    type CommitAttackOffer,
    type Good,
    type TileId,
    type WeaponOffer,
    type WritId
} from '@tabletop/feudum'
import { tallyLines, type FlowPlay, type TallyLine } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import {
    coverChoices,
    DeciderDraft,
    draftChoice,
    playUnless,
    type DraftChoice
} from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import { coverNeeds, coverSpends, loneCover } from './tileCover.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { weaponLabel } from './writLabels.js'

type GoodPrice = Partial<Record<Good, number>>

export type CommitAdd =
    | { readonly kind: 'saltpeter' }
    | { readonly kind: 'weapon'; readonly writId: WritId; readonly alternative: number }

export type CommitAttackValues = {
    /** R-4.8.2 Stacked, in press order, so Undo takes back the latest (S36). */
    adds: readonly CommitAdd[]
    /** R-4.4-H1 */
    cover: readonly TileId[]
}

export const CommitAttackStageOrder: readonly (keyof CommitAttackValues)[] = ['adds', 'cover']

export interface CommitPanel {
    readonly tally: readonly TallyLine[]
    readonly saltpeter: {
        readonly count: number
        readonly add: DraftChoice
        readonly remove: DraftChoice
    }
    readonly weapons: readonly {
        readonly writId: WritId
        readonly alternatives: readonly DraftChoice[]
    }[]
    readonly covers?: readonly DraftChoice[]
    readonly primary: TurnPrimary
}

function addGood(price: GoodPrice, good: Good): GoodPrice {
    return { ...price, [good]: (price[good] ?? 0) + 1 }
}

/** R-4.8.2 What these adds turn in. */
function priceOf(adds: readonly CommitAdd[], offer: CommitAttackOffer): GoodPrice {
    let price: GoodPrice = {}
    for (const add of adds) {
        const goods =
            add.kind === 'saltpeter'
                ? (['saltpeter'] satisfies Good[])
                : (offer.weapons.find(
                      ({ writId, alternative }) =>
                          writId === add.writId && alternative === add.alternative
                  )?.turnedIn ?? [])
        for (const good of goods) {
            price = addGood(price, good)
        }
    }
    return price
}

const isWeapon =
    ({ writId }: WeaponOffer) =>
    (add: CommitAdd) =>
        add.kind === 'weapon' && add.writId === writId

/** R-4.8.2 The attacker's saltpeter and weapons; the logic's preview is the tally. */
export class CommitAttackDraft extends DeciderDraft<CommitAttackValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(CommitAttackStageOrder, contextOf)
    }

    private needsOf(adds: readonly CommitAdd[], { state, playerId }: TurnContext) {
        const offer = commitAttackOffer(state, playerId)
        return offer ? coverNeeds(goodsShort(state, playerId, priceOf(adds, offer))) : []
    }

    protected override withAutos(
        stored: StagedSelectionState<CommitAttackValues>,
        context: TurnContext
    ): StagedSelectionState<CommitAttackValues> {
        const needs = this.needsOf(stored.adds?.value ?? [], context)
        return withLoneChoice<CommitAttackValues, 'cover'>(
            stored,
            CommitAttackStageOrder,
            'cover',
            needs.length > 0 ? loneCover(context.state, context.playerId, needs) : []
        )
    }

    private input(context: TurnContext) {
        const adds = this.value('adds') ?? []
        const cover = this.value('cover') ?? []
        return {
            saltpeter: adds.filter(({ kind }) => kind === 'saltpeter').length,
            weapons: adds.flatMap((add) =>
                add.kind === 'weapon' ? [{ writId: add.writId, alternative: add.alternative }] : []
            ),
            ...(cover.length > 0
                ? { wildTiles: coverSpends(cover, this.needsOf(adds, context)) }
                : {})
        }
    }

    private preview = $derived.by(() => {
        const context = this.contextOf()
        return context && commitAttackPreview(context.state, context.playerId, this.input(context))
    })

    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { preview } = this
        if (!context || !preview) {
            return undefined
        }
        const data = this.input(context)
        return playUnless(preview.refused, (maker) => maker.createPlayerAction(CommitAttack, data))
    })

    /** Short of more than the seat's tiles can bring, this add can't go on. */
    private canAdd(
        adds: readonly CommitAdd[],
        offer: CommitAttackOffer,
        { state, playerId }: TurnContext
    ): boolean {
        return canCoverWithWildTiles(state, playerId, priceOf(adds, offer))
    }

    private saltpeterRows(adds: readonly CommitAdd[], offer: CommitAttackOffer, c: TurnContext) {
        const count = adds.filter(({ kind }) => kind === 'saltpeter').length
        const more = [...adds, { kind: 'saltpeter' } as const]
        return {
            count,
            add: draftChoice(
                'Add saltpeter',
                false,
                () => {
                    this.push('adds', more)
                },
                count >= offer.saltpeterMost || !this.canAdd(more, offer, c)
                    ? `You may add ${Math.min(count, offer.saltpeterMost)} saltpeter.`
                    : undefined
            ),
            remove: draftChoice(
                'Take saltpeter off',
                false,
                () => {
                    this.push(
                        'adds',
                        adds.toSpliced(
                            adds.findLastIndex(({ kind }) => kind === 'saltpeter'),
                            1
                        )
                    )
                },
                count === 0 ? 'No saltpeter is added.' : undefined
            )
        }
    }

    private weaponChoice(
        weapon: WeaponOffer,
        adds: readonly CommitAdd[],
        offer: CommitAttackOffer,
        context: TurnContext
    ): DraftChoice {
        const { writId, alternative } = weapon
        const others = adds.filter((add) => !isWeapon(weapon)(add))
        const picked = adds.some(
            (add) =>
                add.kind === 'weapon' && add.writId === writId && add.alternative === alternative
        )
        const after: readonly CommitAdd[] = picked
            ? others
            : [...others, { kind: 'weapon', writId, alternative }]
        return draftChoice(
            weaponLabel(writId, alternative),
            picked,
            () => {
                this.push('adds', after)
            },
            this.canAdd(after, offer, context) ? undefined : "You can't turn that in as well."
        )
    }

    panel: CommitPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = context && commitAttackOffer(context.state, context.playerId)
        const { preview } = this
        if (!context || !offer || !preview) {
            return undefined
        }
        const adds = this.value('adds') ?? []
        const cover = this.value('cover') ?? []
        const needs = this.needsOf(adds, context)
        const { regionTiles } = context.state.getPlayerState(context.playerId)
        const { attack, defence, attackerWins } = preview.strength
        const held = [...new Set(offer.weapons.map(({ writId }) => writId))]
        return {
            tally: tallyLines(preview.strength),
            saltpeter: this.saltpeterRows(adds, offer, context),
            weapons: held.map((writId) => ({
                writId,
                alternatives: offer.weapons
                    .filter((weapon) => weapon.writId === writId)
                    .map((weapon) => this.weaponChoice(weapon, adds, offer, context))
            })),
            ...(needs.length > 0 && regionTiles.length !== needs.length
                ? {
                      covers: coverChoices(context.state, regionTiles, cover, needs, (after) => {
                          this.push('cover', after)
                      })
                  }
                : {}),
            primary: {
                label: `Attack ${attack.total} vs ${defence.total}: ${attackerWins ? `wins · +${preview.vp} vp` : 'fails'}`,
                enabled: this.play !== undefined
            }
        }
    })
}
