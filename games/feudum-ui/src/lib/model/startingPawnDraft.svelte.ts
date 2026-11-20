import type { Character, SpaceId } from '@tabletop/feudum'
import { StagedDraft } from './stagedDraft.svelte.js'

export type StartingPawnPress =
    | { readonly kind: 'character'; readonly character: Character }
    | { readonly kind: 'space'; readonly spaceId: SpaceId }

export type StartingPawnValues = {
    /** Character or space, whichever was pressed first; a press of the same kind replaces it. */
    first: StartingPawnPress
    /** The other kind, which completes the Action. */
    second: StartingPawnPress
}

export const StartingPawnStageOrder = [
    'first',
    'second'
] as const satisfies readonly (keyof StartingPawnValues)[]
type MissingStages = Exclude<keyof StartingPawnValues, (typeof StartingPawnStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

/**
 * R-1.4.9 `PlaceStartingPawn` with character and space in either order (contract: Setup; S2). The
 * stages hold presses rather than a fixed character-then-space, since the shared helpers clear
 * every later stage and a space pressed first must survive the character press.
 */
export class StartingPawnDraft extends StagedDraft<StartingPawnValues> {
    constructor() {
        super(StartingPawnStageOrder)
    }

    private held<TKind extends StartingPawnPress['kind']>(
        kind: TKind
    ): Extract<StartingPawnPress, { kind: TKind }> | undefined {
        const presses = [this.value('first'), this.value('second')]
        return presses.find((press): press is Extract<StartingPawnPress, { kind: TKind }> => {
            return press?.kind === kind
        })
    }

    get character(): Character | undefined {
        return this.held('character')?.character
    }

    get spaceId(): SpaceId | undefined {
        return this.held('space')?.spaceId
    }

    /** The space was pressed first, so the character popup is open beside it. */
    get asksCharacter(): boolean {
        return this.spaceId !== undefined && this.character === undefined
    }

    get complete(): boolean {
        return this.character !== undefined && this.spaceId !== undefined
    }

    /** Pressing the first pick again unpicks it. */
    press(press: StartingPawnPress): void {
        const first = this.value('first')
        if (first && this.samePress(first, press)) {
            this.clearFrom('first')
        } else if (first && first.kind !== press.kind) {
            this.set('second', press)
        } else {
            this.push('first', press)
        }
    }

    private samePress(a: StartingPawnPress, b: StartingPawnPress): boolean {
        return a.kind === 'character'
            ? b.kind === 'character' && a.character === b.character
            : b.kind === 'space' && a.spaceId === b.spaceId
    }
}
