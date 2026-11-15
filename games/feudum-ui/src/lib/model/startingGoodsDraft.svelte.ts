import type { StagedSelectionState } from '@tabletop/frontend-components'
import { StartingGoodsChosen, type Good } from '@tabletop/feudum'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'

export type SulfurDestination = 'supply' | 'barrel'

/** R-1.4.8 The pick as it stands: the goods, and where a picked sulfur goes. */
export interface StartingGoodsPick {
    readonly goods: readonly Good[]
    readonly sulfurTo: SulfurDestination
}

export type StartingGoodsValues = {
    /** A tap list: each press, on a good or on the sulfur's destination, pushes the pick as it now stands. */
    pick: StartingGoodsPick
}

export const StartingGoodsStageOrder = [
    'pick'
] as const satisfies readonly (keyof StartingGoodsValues)[]
type MissingStages = Exclude<keyof StartingGoodsValues, (typeof StartingGoodsStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

/** R-1.4.8 Sulfur is kept unless the seat puts it into the barrel, as `ChooseStartingGoods` takes it. */
const NothingPicked: StartingGoodsPick = { goods: [], sulfurTo: 'supply' }

/** R-1.4.8 `ChooseStartingGoods` (contract: Setup; S1). */
export class StartingGoodsDraft extends StagedDraft<StartingGoodsValues> {
    constructor(private readonly offers: () => readonly Good[]) {
        super(StartingGoodsStageOrder)
    }

    /** R-1.4.8 With exactly three goods in the haversack the pick is the lone legal choice. */
    protected override read(): StagedSelectionState<StartingGoodsValues> {
        return withLoneChoice<StartingGoodsValues, 'pick'>(
            super.read(),
            StartingGoodsStageOrder,
            'pick',
            this.forced ? [{ ...NothingPicked, goods: [...this.offers()] }] : []
        )
    }

    private get forced(): boolean {
        return this.offers().length === StartingGoodsChosen
    }

    private get pick(): StartingGoodsPick {
        return this.value('pick') ?? NothingPicked
    }

    get goods(): readonly Good[] {
        return this.pick.goods
    }

    get sulfurTo(): SulfurDestination {
        return this.pick.sulfurTo
    }

    /** The sulfur's own line: it stands while sulfur is picked. */
    get asksSulfur(): boolean {
        return this.goods.includes('sulfur')
    }

    get ready(): boolean {
        return this.goods.length === StartingGoodsChosen
    }

    /**
     * A tap list: a press picks the good, or unpicks it, the sulfur's destination kept. Unpicking the
     * sulfur drops its destination. A fourth pick and a forced pick do nothing.
     */
    press(good: Good): void {
        const { goods, sulfurTo } = this
        if (this.forced) {
            return
        }
        if (goods.includes(good)) {
            this.push('pick', {
                goods: goods.filter((picked) => picked !== good),
                sulfurTo: good === 'sulfur' ? NothingPicked.sulfurTo : sulfurTo
            })
        } else if (goods.length < StartingGoodsChosen) {
            this.push('pick', { goods: [...goods, good], sulfurTo })
        }
    }

    chooseSulfurDestination(destination: SulfurDestination): void {
        if (this.asksSulfur && destination !== this.sulfurTo) {
            this.push('pick', { goods: this.goods, sulfurTo: destination })
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
