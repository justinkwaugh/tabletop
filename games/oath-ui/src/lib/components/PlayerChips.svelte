<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    let {
        label,
        playerIds,
        picked,
        onpick,
        busy
    }: {
        /** The pick's few words before the chips ("With:", "Call:"). */
        label: string
        playerIds: readonly string[]
        picked: string | undefined
        /** The player tapped; undefined when the picked chip is tapped again. */
        onpick: (playerId: string | undefined) => void
        busy: boolean
    } = $props()

    const width = new ChoiceWidth()
</script>

<!-- A player is their chip, in a frame as wide as the widest beside it, 44 px tall on a phone: a
     tap picks them, a second tap drops them. -->
<div class="flex flex-wrap items-center gap-2 text-xs">
    <span class="text-oath-text-muted">{label}</span>
    {#each playerIds as id (id)}
        <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border p-[3px] text-sm
                   disabled:opacity-40 max-sm:min-h-11 max-sm:px-1.5 {picked === id
                ? 'border-oath-accent ring-2 ring-oath-accent'
                : 'border-oath-frame bg-oath-surface'}"
            aria-pressed={picked === id}
            disabled={busy}
            onclick={() => onpick(picked === id ? undefined : id)}
        >
            <span class="flex justify-center" style:min-width="{width.widest}px">
                <span class="w-max" {@attach width.measure}><PlayerName playerId={id} /></span>
            </span>
        </button>
    {/each}
</div>
