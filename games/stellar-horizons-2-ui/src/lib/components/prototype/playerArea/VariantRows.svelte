<script lang="ts">
    // PROTOTYPE (variant D): one aligned row per player. The chosen faction's detail is the wide
    // sheet under the map on wide screens, and the console stacked below the rows on narrow ones.
    import { ShipKind } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import {
        MOCK_FACTIONS,
        playerArea,
        totalSettlements,
        type MockFaction
    } from './campaignMock.svelte.js'
    import Console from './Console.svelte'

    function count(faction: MockFaction, kind: ShipKind): number {
        return faction.ships.filter((ship) => ship.ship.kind === kind).length
    }

    function warning(faction: MockFaction): string | undefined {
        const blockaded = faction.bases.filter((base) => base.blockaded).length
        const parts = [
            faction.canAttack ? '' : 'can’t attack',
            blockaded > 0 ? `${blockaded} base${blockaded > 1 ? 's' : ''} blockaded` : ''
        ].filter(Boolean)
        return parts.length > 0 ? parts.join(', ') : undefined
    }

    function choose(faction: MockFaction) {
        playerArea.selected = faction.faction
        playerArea.sheetOpen = true
    }
</script>

<div class="standings">
    <div class="row head" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <span class="num" title="Robotic explorers in play">RE</span>
        <span class="num" title="Crew vehicles in play">CV</span>
        <span class="num" title="Settlements at bases">SET</span>
        <span class="num">$B</span>
    </div>
    {#each MOCK_FACTIONS as faction (faction.faction)}
        {@const warn = warning(faction)}
        <button
            type="button"
            class="row"
            class:selected={playerArea.selected === faction.faction}
            style:--faction={FACTION_FILL[faction.faction]}
            onclick={() => choose(faction)}
            title="{factionName(faction.faction)}{warn ? `: ${warn}` : ''}"
        >
            <span class="init">{faction.initiative}</span>
            <img src={FACTION_ART[faction.faction]} alt="" width="26" height="26" />
            <span class="who">
                <span class="name"
                    >{faction.you ? 'You' : faction.player}{#if warn}<span
                            class="warn"
                            aria-label={warn}>!</span
                        >{/if}</span
                >
                <span class="step" class:done={faction.step === 'Done'}>{faction.step}</span>
            </span>
            <span class="num">{count(faction, ShipKind.RE)}</span>
            <span class="num">{count(faction, ShipKind.CV)}</span>
            <span class="num">{totalSettlements(faction)}</span>
            <span class="num cash">{faction.cash}</span>
        </button>
    {/each}
</div>

{#if !playerArea.wide.current}
    <div class="stacked"><Console faction={playerArea.selectedFaction} /></div>
{/if}

<style>
    .standings {
        display: flex;
        flex-direction: column;
        border: 1px solid #1e2b44;
        border-radius: 8px;
        overflow: hidden;
        background: #0d1322;
    }
    .row {
        display: grid;
        grid-template-columns: 12px 26px minmax(0, 1fr) 22px 22px 30px 32px;
        align-items: center;
        gap: 9px;
        padding: 5px 8px;
        text-align: left;
        color: #dbe7f5;
        border-top: 1px solid #1a2438;
    }
    .row.head {
        padding: 4px 8px;
        border-top: none;
        color: #8fa4c2;
        font-size: 11.5px;
        font-weight: 700;
    }
    .row.selected {
        background: color-mix(in srgb, var(--faction) 34%, #0d1322);
    }
    .row img {
        border-radius: 3px;
    }
    .init {
        font-size: 13px;
        font-weight: 800;
        color: #8fa4c2;
        text-align: center;
    }
    .who {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.15;
    }
    .name {
        font-size: 14.5px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .warn {
        display: inline-block;
        width: 14px;
        margin-left: 5px;
        border-radius: 3px;
        background: #c8402f;
        color: #fff;
        font-size: 11px;
        font-weight: 900;
        line-height: 14px;
        text-align: center;
    }
    .step {
        font-size: 11.5px;
        color: #9fb4d0;
        white-space: nowrap;
    }
    .step.done {
        color: #7fe08a;
    }
    .num {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        font-size: 14.5px;
        font-weight: 700;
    }
    .cash {
        color: #f2c94c;
    }
    .stacked {
        margin-top: 8px;
    }
</style>
