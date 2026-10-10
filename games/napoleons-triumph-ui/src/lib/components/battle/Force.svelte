<script lang="ts">
    import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        units,
        selected = [],
        markers = {},
        onpick
    }: {
        units: ProjectedUnit[]
        selected?: string[]
        markers?: Record<string, string>
        onpick?: (unitId: string) => void
    } = $props()

    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap gap-x-1 gap-y-0.5">
    {#each units as unit (unit.id)}
        <UnitTile
            playerId={unit.playerId}
            face={gameSession.visibleFace(unit)}
            selected={selected.includes(unit.id)}
            marker={markers[unit.id]}
            label="Choose this unit"
            onclick={onpick ? () => onpick(unit.id) : undefined}
        />
    {/each}
</div>
