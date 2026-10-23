<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { BattleRole } from '$lib/model/battleStage.js'
    import { corpsClusters } from '$lib/model/corpsClusters.js'
    import { roleMarkOf, type RoleMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { corpsName } from '$lib/utils/groupNames.js'
    import CommanderChip from './CommanderChip.svelte'

    let {
        units,
        selected = [],
        roles = {},
        markers = {},
        marks = {},
        lettersOnly = false,
        byCorps = false,
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
        byCorps?: boolean
        /** What is printed on a unit that has no role to show: the steps it is to lose. */
        marks?: Record<string, RoleMark | undefined>
        onlyPickableIds?: readonly string[]
        onpick?: (unitId: string) => void
        /** What stands after the units, in the same row. */
        children?: Snippet
    } = $props()

    const gameSession = getGameSession()
    const clusters = $derived(
        byCorps && units.length > 0
            ? corpsClusters(units, (some) => gameSession.asRead(units[0].playerId, some))
            : []
    )
    const gap = $derived(onpick ? 'gap-x-1' : 'gap-x-0')
    // Two tiles fit side by side on a phone; a wrapped row would stretch the corps, and its rule, across the panel.
    const PHONE_COLUMNS = 2
</script>

{#snippet tile(unit: ProjectedUnit)}
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
{/snippet}

{#if byCorps}
    <div class="nt-force-clusters">
        {#each clusters as cluster (cluster.commanderId ?? '')}
            <div
                class="nt-force-cluster"
                style:--phone-columns={Math.min(cluster.units.length, PHONE_COLUMNS)}
            >
                <div class="nt-force-head">
                    {#if cluster.commanderId}
                        <CommanderChip
                            commanderId={cluster.commanderId}
                            playerId={cluster.units[0].playerId}
                            label={corpsName(cluster.commanderId)}
                        />
                    {:else}
                        <span class="nt-force-detached">Detached</span>
                    {/if}
                </div>
                <div class="nt-force-tiles flex flex-wrap items-start gap-y-0.5 {gap}">
                    {#each cluster.units as unit (unit.id)}
                        {@render tile(unit)}
                    {/each}
                </div>
            </div>
        {/each}
        {@render children?.()}
    </div>
{:else}
    <div class="flex flex-wrap items-start gap-y-0.5 {gap}">
        {#each units as unit (unit.id)}
            {@render tile(unit)}
        {/each}
        {@render children?.()}
    </div>
{/if}

<style>
    .nt-force-clusters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 6px 22px;
    }

    .nt-force-cluster {
        display: flex;
        flex-direction: column;
    }

    /* Held to CommanderChip's height (a 26px flag in a 2px border) with this padding and rule, so the detached units' rule lines up with the commanders'. */
    .nt-force-head {
        display: flex;
        align-items: flex-end;
        min-height: 35px;
        margin-bottom: 4px;
        padding-bottom: 2px;
        border-bottom: 1.5px solid color-mix(in srgb, var(--nt-ink) 45%, transparent);
    }

    .nt-force-detached {
        display: inline-block;
        padding: 3px 4px 0 2px;
        font-size: 13px;
        font-style: italic;
        opacity: 0.7;
    }

    @media (max-width: 639px) {
        .nt-force-tiles {
            display: grid;
            grid-template-columns: repeat(var(--phone-columns), max-content);
        }
    }
</style>
