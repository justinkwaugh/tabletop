export interface LocalSelection {
    hasManual(): boolean
    undo(): boolean
    clear(): void
}

export class LocalSelections {
    readonly #selections: LocalSelection[] = []

    register(selection: LocalSelection, precedence: 'first' | 'last' = 'last'): void {
        if (precedence === 'first') this.#selections.unshift(selection)
        else this.#selections.push(selection)
    }

    hasManual(): boolean {
        return this.#selections.some((selection) => selection.hasManual())
    }

    undo(): boolean {
        return this.#selections.some((selection) => selection.undo())
    }

    clear(): void {
        for (const selection of this.#selections) selection.clear()
    }
}
