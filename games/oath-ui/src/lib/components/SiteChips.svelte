<script lang="ts">
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    let {
        label,
        sites,
        picked,
        onpick,
        busy
    }: {
        /** The pick's few words before the buttons ("the site you act as if you are at:"). */
        label: string
        sites: readonly { siteId: string; name: string }[]
        picked: string | undefined
        onpick: (siteId: string) => void
        busy: boolean
    } = $props()

    const width = new ChoiceWidth()
</script>

<!-- A site is a button with its name, as a player is their chip (PlayerChips): as wide as the
     widest beside it, 44 px tall on a phone. -->
<div class="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label={label}>
    <span class="text-oath-text-muted">{label}</span>
    {#each sites as site (site.siteId)}
        {@const on = picked === site.siteId}
        <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border px-2 py-[3px] text-sm
                   disabled:opacity-40 max-sm:min-h-11 {on
                ? 'border-oath-accent ring-2 ring-oath-accent'
                : 'border-oath-frame bg-oath-surface'}"
            aria-pressed={on}
            disabled={busy}
            onclick={() => onpick(site.siteId)}
        >
            <span class="flex justify-center" style:min-width="{width.widest}px">
                <span class="w-max" {@attach width.measure}>{site.name}</span>
            </span>
        </button>
    {/each}
</div>
