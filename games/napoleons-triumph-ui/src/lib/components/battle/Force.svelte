<script lang="ts">
    import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { BattleRole } from '$lib/model/battleStage.js'
    import { roleMarkOf, type RoleMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        units,
        selected = [],
        roles = {},
        markers = {},
        marks = {},
        onlyPickableIds,
        onpick
    }: {
        units: ProjectedUnit[]
        selected?: string[]
        roles?: Record<string, BattleRole>
        markers?: Record<string, string>
        /** What is printed on a unit that has no role to show: the steps it is to lose. */
        marks?: Record<string, RoleMark | undefined>
        onlyPickableIds?: readonly string[]
        onpick?: (unitId: string) => void
    } = $props()

    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap gap-x-1 gap-y-0.5">
    {#each units as unit (unit.id)}
        {@const role = roles[unit.id]}
        <UnitTile
            playerId={unit.playerId}
            face={gameSession.visibleFace(unit)}
            selected={selected.includes(unit.id)}
            dimmed={onlyPickableIds !== undefined && !onlyPickableIds.includes(unit.id)}
            marker={role ?? markers[unit.id]}
            roleMark={role === undefined ? marks[unit.id] : roleMarkOf(role)}
            label="Choose this unit"
            onclick={onpick && onlyPickableIds?.includes(unit.id) !== false
                ? () => onpick(unit.id)
                : undefined}
        />
    {/each}
</div>
