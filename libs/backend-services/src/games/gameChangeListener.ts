import type { Game } from '@tabletop/common'

/** Told of each committed game write; must never fail or delay the write. */
export interface GameChangeListener {
    applyChange(before: Game | undefined, after: Game | undefined): Promise<void>
}
