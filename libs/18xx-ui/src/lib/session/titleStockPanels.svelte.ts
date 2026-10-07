import type { LocalSelection } from './localSelections.js'
import type { StockMenuOption } from '../stock/stockActionSelection.js'
import type { StockModule } from './stockModule.svelte.js'

export type TitleStockPanel<Panel extends string> = {
    id: Panel
    /** The menu entry that opens the panel. */
    label: string
    /** Whether the panel has anything for the acting player. */
    available(): boolean
    /** Whether the panel stays open whatever was chosen, such as while acting for a company. */
    held?(): boolean
}

/**
 * The panels a title adds beside the stock round's Buy and Sell menus. At most one is open; a
 * chosen panel is a local selection that Undo clears.
 */
export class TitleStockPanels<Panel extends string> implements LocalSelection {
    #chosen = $state<Panel>()
    constructor(
        private readonly stock: Pick<StockModule, 'openMenu' | 'chooseMenu'>,
        private readonly panels: readonly TitleStockPanel<Panel>[]
    ) {}
    readonly open = $derived.by((): Panel | undefined => {
        if (this.stock.openMenu) return undefined
        const held = this.panels.find((panel) => panel.held?.() && panel.available())
        if (held) return held.id
        return this.panels.find((panel) => panel.id === this.#chosen && panel.available())?.id
    })
    get count(): number {
        return this.panels.filter((panel) => panel.available()).length
    }
    /** The stock menu entries for the panels with something to offer. */
    get menuOptions(): StockMenuOption[] {
        return this.panels
            .filter((panel) => panel.available())
            .map((panel) => ({
                label: panel.label,
                selected: this.open === panel.id,
                onSelect: () => this.choose(panel.id)
            }))
    }
    choose(panel: Panel): void {
        this.stock.chooseMenu(undefined)
        this.#chosen = panel
    }
    hasManual(): boolean {
        return !!this.#chosen
    }
    undo(): boolean {
        if (!this.#chosen) return false
        this.#chosen = undefined
        return true
    }
    clear(): void {
        this.#chosen = undefined
    }
}
