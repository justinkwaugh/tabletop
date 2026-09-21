export interface SessionDraft {
    pending(): boolean
    unwind(): boolean
    clear(): void
}

export class SessionDrafts {
    readonly #drafts: SessionDraft[] = []

    register(draft: SessionDraft, precedence: 'first' | 'last' = 'last'): void {
        if (precedence === 'first') this.#drafts.unshift(draft)
        else this.#drafts.push(draft)
    }

    pending(): boolean {
        return this.#drafts.some((draft) => draft.pending())
    }

    unwind(): boolean {
        return this.#drafts.some((draft) => draft.unwind())
    }

    clear(): void {
        for (const draft of this.#drafts) draft.clear()
    }
}

export function clearableDraft(isSet: () => boolean, reset: () => void): SessionDraft {
    return {
        pending: isSet,
        unwind() {
            if (!isSet()) return false
            reset()
            return true
        },
        clear: reset
    }
}
