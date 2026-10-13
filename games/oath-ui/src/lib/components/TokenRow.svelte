<script lang="ts">
    import { range } from '@tabletop/common'
    import type { SizedImage } from '$lib/images/manifestIndex.js'

    // A count picked from the pieces themselves (favor, secrets, warbands), one per unit held. A
    // tap on the Nth piece sets the count to N and rings the pieces up to it; a tap on the piece at
    // the count sets 0, or the floor where the count may not go under one (a banner's least bid).
    // A piece the rules do not let the count reach (over `addable`, or under `floor`) cannot be
    // tapped and keeps its place; one under the floor is still drawn picked, as it is paid.
    // `tone`: a picked piece that is placed, given or moved is ringed gold; one that dies or burns,
    // rose; a row whose tap sends at once (`plain`) never shows a pick, its pieces whole.
    // 34 x 32 px, 44 px square on a phone. With `per` 2 the pieces go in pairs (Witch's Bargain's
    // favor): one button holds a pair, 54 x 32 px and 66 x 44 on a phone, and `addable`, `picked`
    // and the count `label` and `ontap` take count pairs; a lone last piece keeps its place after
    // the pairs and is never a button.
    let {
        image,
        held,
        addable,
        picked,
        label,
        ontap,
        busy,
        tone = 'gold',
        per = 1,
        floor = 0
    }: {
        image: SizedImage
        held: number
        addable: number
        picked: number
        label: (count: number) => string
        ontap: (count: number) => void
        busy: boolean
        tone?: 'gold' | 'rose' | 'plain'
        per?: 1 | 2
        floor?: number
    } = $props()

    let plain = $derived(tone === 'plain')
    let ring = $derived(
        tone === 'rose'
            ? 'border-oath-danger bg-oath-danger-soft ring-1 ring-oath-danger'
            : 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
    )
    let units = $derived(Math.floor(held / per))
    let leftover = $derived(held - units * per)
</script>

<span class="inline-flex flex-wrap items-center gap-1">
    {#each range(1, units) as count (count)}
        {@const on = !plain && count <= picked}
        {@const untappable = count > addable || count < floor}
        <button
            type="button"
            class="inline-flex h-8 flex-none items-center justify-center gap-0.5 rounded-md border
                   max-sm:h-11 {per === 2 ? 'w-[54px] max-sm:w-[66px]' : 'w-[34px] max-sm:w-11'} {on
                ? ring
                : 'border-oath-frame bg-oath-surface'} {busy || (untappable && !on)
                ? 'opacity-40'
                : ''}"
            aria-pressed={plain ? undefined : on}
            aria-label={label(count)}
            disabled={busy || untappable}
            onclick={() => ontap(count)}
        >
            {#each range(1, per) as piece (piece)}
                <img
                    class="h-5 w-auto max-sm:h-6 {on || plain ? '' : 'opacity-35'}"
                    src={image.src}
                    width={image.width}
                    height={image.height}
                    alt=""
                />
            {/each}
        </button>
    {/each}
    {#if leftover > 0}
        <span
            class="inline-flex h-8 w-[34px] flex-none items-center justify-center rounded-md border
                   border-oath-frame bg-oath-surface opacity-40 max-sm:h-11 max-sm:w-11"
            data-leftover-piece
            aria-hidden="true"
        >
            <img
                class="h-5 w-auto opacity-35 max-sm:h-6"
                src={image.src}
                width={image.width}
                height={image.height}
                alt=""
            />
        </span>
    {/if}
</span>
