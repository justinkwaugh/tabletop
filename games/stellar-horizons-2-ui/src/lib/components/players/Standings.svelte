<script lang="ts">
    // One aligned row per player, in initiative order. Clicking a row shows that player in the
    // console below.
    import { TurnStep } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { standings } from '$lib/utils/playerArea.js'
    import { FACTION_FILL, STEP_LABELS, factionName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const rows = $derived(standings(gameSession.gameState))

    function name(playerId: string): string {
        return playerId === gameSession.myPlayerId ? 'You' : gameSession.getPlayerName(playerId)
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
    {#each rows as row (row.playerId)}
        <button
            type="button"
            class="row"
            class:selected={gameSession.consolePlayerId === row.playerId}
            aria-pressed={gameSession.consolePlayerId === row.playerId}
            style:--faction={row.faction ? FACTION_FILL[row.faction] : '#3d4a63'}
            title={row.faction ? factionName(row.faction) : 'Choosing a faction'}
            onclick={() => gameSession.showConsole(row.playerId)}
        >
            <span class="init">{row.initiative}</span>
            {#if row.faction}
                <img src={FACTION_ART[row.faction]} alt="" width="26" height="26" />
            {:else}
                <span class="blank"></span>
            {/if}
            <span class="who">
                <span class="name">{name(row.playerId)}</span>
                {#if row.step}
                    <span class="step" class:done={row.step === TurnStep.Done}
                        >{row.step === TurnStep.Done ? 'Done' : STEP_LABELS[row.step]}</span
                    >
                {:else if !row.faction}
                    <span class="step">Choosing a faction</span>
                {/if}
            </span>
            <span class="num">{row.explorers}</span>
            <span class="num">{row.crewVehicles}</span>
            <span class="num">{row.settlements}</span>
            <span class="num cash">{row.cash}</span>
        </button>
    {/each}
</div>

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
        min-height: 42px;
        padding: 5px 8px;
        text-align: left;
        color: #dbe7f5;
        border-top: 1px solid #1a2438;
    }

    .row.head {
        min-height: 0;
        padding: 4px 8px;
        border-top: none;
        color: #8fa4c2;
        font-size: 11.5px;
        font-weight: 700;
    }

    button.row:hover {
        background: color-mix(in srgb, var(--faction) 16%, #0d1322);
    }

    button.row.selected {
        background: color-mix(in srgb, var(--faction) 34%, #0d1322);
    }

    .row img,
    .blank {
        width: 26px;
        height: 26px;
        border-radius: 3px;
    }

    .blank {
        border: 1px dashed #3a4a68;
        box-sizing: border-box;
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
</style>
