import type { PickFrame } from '$lib/model/boardFocus.svelte.js'

/** The open pick's frame as a spec sets it, read as reactively as the session's own. */
export class OpenPick {
    frame: PickFrame | undefined = $state.raw(undefined)

    readonly read = (): PickFrame | undefined => this.frame
}
