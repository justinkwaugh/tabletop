<script lang="ts">
    import type { Snippet } from 'svelte'
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
        lettersOnly = false,
        onlyPickableIds,
        onpick,
        children
    }: {
        units: ProjectedUnit[]
        selected?: string[]
        roles?: Record<string, BattleRole>
        markers?: Record<string, string>
        /** A role is told by the letter on the block alone, with no word under it. */
        lettersOnly?: boolean
        /** What is printed on a unit that has no role to show: the steps it is to lose. */
        marks?: Record<string, RoleMark | undefined>
        onlyPickableIds?: readonly string[]
        onpick?: (unitId: string) => void
        /** What stands after the units, in the same row. */
        children?: Snippet
    } = $props()

    const gameSession = getGameSession()
</script>

<div class="flex flex-wrap items-start gap-y-0.5 {onpick ? 'gap-x-1' : 'gap-x-0'}">
    {#each units as unit (unit.id)}
        {@const role = roles[unit.id]}
        <UnitTile
            playerId={unit.playerId}
            {...gameSession.lookOf(unit)}
            selected={selected.includes(unit.id)}
            close={!onpick}
            dimmed={onlyPickableIds !== undefined && !onlyPickableIds.includes(unit.id)}
            marker={lettersOnly ? undefined : (role ?? markers[unit.id])}
            roleMark={role === undefined ? marks[unit.id] : roleMarkOf(role)}
            label="Choose this unit"
            onclick={onpick && onlyPickableIds?.includes(unit.id) !== false
                ? () => onpick(unit.id)
                : undefined}
        />
    {/each}
    {@render children?.()}
</div>
