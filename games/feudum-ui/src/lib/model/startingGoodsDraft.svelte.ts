import type { StagedSelectionState } from '@tabletop/frontend-components'
import { StartingGoodsChosen, type Good } from '@tabletop/feudum'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'

export type SulfurDestination = 'supply' | 'barrel'

export type StartingGoodsValues = {
    /** A tap list: each press pushes the list as it now stands. */
    goods: Good[]
    sulfurTo: SulfurDestination
}

export const StartingGoodsStageOrder = [
    'goods',
    'sulfurTo'
] as const satisfies readonly (keyof StartingGoodsValues)[]
type MissingStages = Exclude<keyof StartingGoodsValues, (typeof StartingGoodsStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

/** R-1.4.8 `ChooseStartingGoods` (contract: Setup; S1). */
export class StartingGoodsDraft extends StagedDraft<StartingGoodsValues> {
    constructor(private readonly offers: () => readonly Good[]) {
        super(StartingGoodsStageOrder)
    }

    /** R-1.4.8 With exactly three goods in the haversack the pick is the lone legal choice. */
    protected override read(): StagedSelectionState<StartingGoodsValues> {
        const offers = this.offers()
        return withLoneChoice<StartingGoodsValues, 'goods'>(
            super.read(),
            StartingGoodsStageOrder,
            'goods',
            offers.length === StartingGoodsChosen ? [[...offers]] : []
        )
    }

    get goods(): readonly Good[] {
        return this.value('goods') ?? []
    }

    get sulfurTo(): SulfurDestination | undefined {
        return this.value('sulfurTo')
    }

    /** The popup beside sulfur. */
    get asksSulfurDestination(): boolean {
        return this.goods.includes('sulfur') && !this.sulfurTo
    }

    get ready(): boolean {
        return this.goods.length === StartingGoodsChosen && !this.asksSulfurDestination
    }

    /** A tap list: a press picks the good, or unpicks it. A fourth pick and a forced pick do nothing. */
    press(good: Good): void {
        const { goods } = this
        if (this.entry('goods')?.source === 'auto') {
            return
        }
        if (goods.includes(good)) {
            this.push(
                'goods',
                goods.filter((picked) => picked !== good)
            )
        } else if (goods.length < StartingGoodsChosen) {
            this.push('goods', [...goods, good])
        }
    }

    chooseSulfurDestination(destination: SulfurDestination): void {
        if (this.goods.includes('sulfur')) {
            this.set('sulfurTo', destination)
        }
    }

    /** "Take saltpeter, sulfur (barrel), iron" */
    get primaryName(): string {
        const named = this.goods.map((good) =>
            good === 'sulfur' && this.sulfurTo === 'barrel' ? 'sulfur (barrel)' : good
        )
        return `Take ${named.join(', ')}`
    }
}
