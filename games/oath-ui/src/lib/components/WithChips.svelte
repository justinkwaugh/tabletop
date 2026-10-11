<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'

    let {
        playerIds,
        picked,
        onpick,
        busy
    }: {
        playerIds: readonly string[]
        picked: string | undefined
        /** The player tapped; undefined when the picked chip is tapped again. */
        onpick: (playerId: string | undefined) => void
        busy: boolean
    } = $props()
</script>

<!-- A player is their chip: a tap picks them, a second tap drops them. -->
<div class="flex flex-wrap items-center gap-2 text-xs">
    <span class="text-oath-text-muted">With:</span>
    {#each playerIds as id (id)}
        <button
            type="button"
            class="rounded p-0.5 text-sm max-sm:min-h-11 {picked === id
                ? 'ring-2 ring-oath-accent'
                : 'ring-1 ring-transparent hover:ring-oath-accent'}"
            aria-pressed={picked === id}
            disabled={busy}
            onclick={() => onpick(picked === id ? undefined : id)}
        >
            <PlayerName playerId={id} />
        </button>
    {/each}
</div>
