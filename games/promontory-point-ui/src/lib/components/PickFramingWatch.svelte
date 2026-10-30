<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import type { SpaceId } from '@tabletop/promontory-point'
    import { FramingCommand, litKey, type PickFraming } from '$lib/model/boardFraming.js'

    // Contract, "Phone layout": follows the lit set on display and tells the table when to frame
    // the pick or return to the hex field. It reads the offer and never changes it.
    let {
        lit,
        framing,
        onframe,
        onrest,
        onleave
    }: {
        lit: readonly SpaceId[]
        framing: PickFraming
        onframe: (lit: readonly SpaceId[]) => void
        onrest: (animate: boolean) => void
        // The window is no longer a phone: the board goes back to its usual fit.
        onleave: () => void
    } = $props()

    const key = $derived(litKey(lit))

    // The first rest places the board without motion.
    let shown = false

    // Once for each lit set: the view moves a frame later, once the wrapper has its size.
    const follow: Attachment = () => {
        const current = untrack(() => lit)
        const command = untrack(() => framing.litChanged(current))
        if (command === FramingCommand.None) return
        const animate = shown
        shown = true
        const frame = requestAnimationFrame(() =>
            untrack(() => (command === FramingCommand.Frame ? onframe(current) : onrest(animate)))
        )
        return () => cancelAnimationFrame(frame)
    }

    const leave: Attachment = () => () => untrack(() => onleave())
</script>

<span hidden {@attach leave}></span>

{#key key}
    <span hidden {@attach follow}></span>
{/key}
