<script lang="ts">
    // PROTOTYPE: techs developed per field against the chart, and what was bought this turn.
    import { TECH_FIELDS } from '@tabletop/stellar-horizons-2'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'
    import { TECH_TOTALS, type MockFaction } from './campaignMock.svelte.js'

    let { faction }: { faction: MockFaction } = $props()
</script>

<div class="techs">
    {#each TECH_FIELDS as field (field)}
        {@const total = TECH_TOTALS[field]}
        <div class="field" title="{field}: {faction.techs[field]} of {total} techs developed">
            <div class="name" style:color={FIELD_COLORS[field]}>{field}</div>
            <div class="bar">
                <span
                    style:width="{(faction.techs[field] / total) * 100}%"
                    style:background={FIELD_COLORS[field]}
                ></span>
            </div>
            <div class="count">
                {faction.techs[field]} of {total}{faction.bought.includes(field) ? ' · bought' : ''}
            </div>
        </div>
    {/each}
</div>

<style>
    .techs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    .name {
        font-size: 12.5px;
        font-weight: 700;
    }
    .count {
        margin-top: 2px;
        font-size: 12px;
        color: #b7c7de;
    }
    .bar {
        height: 5px;
        margin-top: 3px;
        background: #1c2740;
        border-radius: 2px;
        overflow: hidden;
    }
    .bar span {
        display: block;
        height: 100%;
    }
</style>
