import type { PickFrame } from '$lib/model/boardFocus.svelte.js'

export class OpenPick {
    frame: PickFrame | undefined = $state.raw(undefined)

    readonly read = (): PickFrame | undefined => this.frame
}
