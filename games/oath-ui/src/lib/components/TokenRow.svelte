<script lang="ts">
    import { range } from '@tabletop/common'
    import type { SizedImage } from '$lib/images/manifestIndex.js'

    // A count picked from the pieces themselves (favor, secrets, warbands), one per unit held. A
    // tap on the Nth piece sets the count to N and rings the pieces up to it; a tap on the piece at
    // the count sets 0. A piece the rules do not let the count reach cannot be tapped and keeps its
    // place. The ring is gold for pieces placed, given or moved, rose for pieces that die or burn.
    // 34 x 32 px, 44 px square on a phone.
    let {
        image,
        held,
        addable,
        picked,
        label,
        ontap,
        busy,
        tone = 'gold'
    }: {
        image: SizedImage
        held: number
        addable: number
        picked: number
        label: (count: number) => string
        ontap: (count: number) => void
        busy: boolean
        tone?: 'gold' | 'rose'
    } = $props()

    let ring = $derived(
        tone === 'rose'
            ? 'border-oath-danger bg-oath-danger-soft ring-1 ring-oath-danger'
            : 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
    )
</script>

<span class="inline-flex flex-wrap items-center gap-1">
    {#each range(1, held) as count (count)}
        {@const on = count <= picked}
        <button
            type="button"
            class="inline-flex h-8 w-[34px] flex-none items-center justify-center rounded-md border
                   disabled:opacity-40 max-sm:h-11 max-sm:w-11 {on
                ? ring
                : 'border-oath-frame bg-oath-surface'}"
            aria-pressed={on}
            aria-label={label(count)}
            disabled={busy || count > addable}
            onclick={() => ontap(count)}
        >
            <img
                class="h-5 w-auto max-sm:h-6 {on ? '' : 'opacity-35'}"
                src={image.src}
                width={image.width}
                height={image.height}
                alt=""
            />
        </button>
    {/each}
</span>
