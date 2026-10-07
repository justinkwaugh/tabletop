<script lang="ts">
    import { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { TablePalette } from '$lib/theme.js'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    const options = [
        { style: BuildingStyle.TowerRoofs, label: 'Roofs' },
        { style: BuildingStyle.PointPips, label: 'Pips' }
    ]
</script>

<div class="toggle" role="radiogroup" aria-label="Height indication">
    <span class="urbino-display px-1.5 text-[10px] tracking-[0.18em] text-(--cream-quiet) max-sm:hidden">HEIGHT INDICATION</span>
    {#each options as option (option.style)}
        {@const checked = session.buildingStyle === option.style}
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            class="option"
            class:checked
            onclick={() => session.setBuildingStyle(option.style)}
        >
            <PieceIcon
                buildingType={BuildingType.Tower}
                color={checked ? TablePalette.mapleLight : TablePalette.mapleDeep}
                buildingStyle={option.style}
                size={20}
            />
            <span class="urbino-display text-[12px] tracking-[0.1em]">{option.label}</span>
        </button>
    {/each}
</div>

<style>
    .toggle {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 10px;
        background: rgb(20 28 36 / 0.7);
        border: 1px solid var(--slate-edge);
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
        backdrop-filter: blur(2px);
    }

    .option {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 6px;
        border-radius: 7px;
        color: var(--cream-quiet);
        transition:
            background-color 150ms,
            color 150ms;
    }

    .option:hover:not(.checked) {
        background: rgb(255 255 255 / 0.07);
        color: var(--cream);
    }

    .option.checked {
        background: var(--maple-plank);
        color: var(--ink);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
    }
</style>
