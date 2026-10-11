<script lang="ts">
    // PROTOTYPE (variant B): one faction sheet per player; yours open, the others open on tap.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import { MOCK_FACTIONS, inkOn, playerArea, totalSettlements } from './campaignMock.svelte.js'
    import Bases from './Bases.svelte'
    import Card from './Card.svelte'
    import Escalation from './Escalation.svelte'
    import Fleet from './Fleet.svelte'
    import Goods from './Goods.svelte'
    import Orders from './Orders.svelte'
    import Resources from './Resources.svelte'

    const ordered = $derived([
        ...MOCK_FACTIONS.filter((faction) => faction.you),
        ...MOCK_FACTIONS.filter((faction) => !faction.you)
    ])
</script>

<div class="sheets">
    {#each ordered as faction (faction.faction)}
        {@const open = playerArea.selected === faction.faction}
        <div
            class="sheet"
            style:--faction={FACTION_FILL[faction.faction]}
            style:--ink={inkOn(faction.faction)}
        >
            <button
                type="button"
                class="head"
                onclick={() => (playerArea.selected = faction.faction)}
            >
                <img src={FACTION_ART[faction.faction]} alt="" width="26" height="26" />
                <span class="who">
                    <span class="name">{faction.you ? 'You' : faction.player}</span>
                    <span class="faction">{factionName(faction.faction)}</span>
                </span>
                <span class="turn">
                    <span>{faction.step}</span>
                    <span>Initiative {faction.initiative}</span>
                </span>
            </button>
            <div class="tray">
                <Resources {faction} marker={26} score />
                <div class="line">
                    <Fleet {faction} size={21} />
                    <Bases {faction} height={19} />
                </div>
                {#if open}
                    <div class="more">
                        <Bases {faction} detail />
                        <div class="earth">
                            <span class="label">Earth</span>
                            <Goods goods={faction.earthGoods} capacity={10} size={15} />
                        </div>
                        {#if faction.hand.length + faction.cards.length > 0}
                            <div class="cards">
                                {#each faction.hand as card (card.name)}
                                    <Card {card} width={92} />
                                {/each}
                                {#each faction.cards as card (card.name)}
                                    <span class="owned"><Card {card} width={92} /></span>
                                {/each}
                            </div>
                        {/if}
                        <Orders {faction} />
                        <Escalation {faction} detail />
                    </div>
                {:else}
                    <div class="summary">
                        <span>{totalSettlements(faction)} settlements</span>
                        <Escalation {faction} />
                        {#if !faction.canAttack}<span class="bad">can’t attack</span>{/if}
                    </div>
                {/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .sheets {
        display: flex;
        flex-direction: column;
        gap: 7px;
    }
    .sheet {
        border-radius: 8px;
        background: var(--faction);
        padding: 0 4px 4px;
    }
    .head {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        padding: 4px 4px;
        color: var(--ink);
        text-align: left;
    }
    .head img {
        border-radius: 3px;
    }
    .who {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        line-height: 1.12;
    }
    .name {
        font-size: 14.5px;
        font-weight: 800;
    }
    .faction {
        font-size: 12px;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.15;
    }
    .tray {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 7px 8px;
        border-radius: 6px;
        background: #080c15;
        color: #dbe7f5;
    }
    .line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
    }
    .more {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 6px;
        border-top: 1px solid #1a2438;
    }
    .earth {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .label {
        font-size: 12.5px;
        color: #9fb4d0;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }
    .summary {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12.5px;
        color: #9fb4d0;
    }
    .bad {
        font-weight: 700;
        color: #ff8a7a;
    }
</style>
