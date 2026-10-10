<script lang="ts">
    import { range } from '@tabletop/common'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'

    // R-6.6.1 — a side's favor or secrets in an offer's terms: one token per unit it holds. A tap
    // on the Nth token sets the count to N and rings the tokens up to it; a tap on the token at the
    // count sets 0. A token the rules do not let the side add cannot be tapped and keeps its place.
    // 34 x 32 px, 44 px square on a phone.
    let {
        token,
        held,
        addable,
        picked,
        label,
        ontap,
        busy
    }: {
        token: 'favor' | 'secrets'
        held: number
        addable: number
        picked: number
        label: (count: number) => string
        ontap: (count: number) => void
        busy: boolean
    } = $props()

    let image = $derived(token === 'favor' ? favorToken() : secretToken())
</script>

<span class="inline-flex flex-wrap items-center gap-1">
    {#each range(1, held) as count (count)}
        {@const on = count <= picked}
        <button
            type="button"
            class="inline-flex h-8 w-[34px] flex-none items-center justify-center rounded-md border
                   disabled:opacity-40 max-sm:h-11 max-sm:w-11 {on
                ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
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
