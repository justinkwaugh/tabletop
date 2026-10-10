<script lang="ts">
    import type { ProjectedUnit, Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import UnitTile from '$lib/components/UnitTile.svelte'

    let {
        side,
        units,
        selected = [],
        markers = {},
        disabled = [],
        onpick
    }: {
        side: Side
        units: ProjectedUnit[]
        selected?: string[]
        /** A note shown under a unit, by unit id. */
        markers?: Record<string, string>
        disabled?: string[]
        onpick?: (unitId: string) => void
    } = $props()

    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap gap-x-1 gap-y-0.5">
    {#each units as unit (unit.id)}
        <UnitTile
            {side}
            face={gameSession.visibleFace(unit)}
            selected={selected.includes(unit.id)}
            marker={markers[unit.id]}
            label="Choose this unit"
            onclick={onpick && !disabled.includes(unit.id) ? () => onpick(unit.id) : undefined}
        />
    {/each}
</div>
