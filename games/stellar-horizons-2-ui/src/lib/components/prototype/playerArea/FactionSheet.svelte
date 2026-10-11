<script lang="ts">
    // PROTOTYPE: a strip of faction tabs below the map, like spreadsheet tabs. Clicking a tab
    // slides that faction's sheet, laid out wide like the printed mat, up over the map.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import { fly } from 'svelte/transition'
    import {
        MOCK_FACTIONS,
        inkOn,
        playerArea,
        totalSettlements,
        type MockFaction
    } from './campaignMock.svelte.js'
    import Bases from './Bases.svelte'
    import Card from './Card.svelte'
    import Coin from './Coin.svelte'
    import Escalation from './Escalation.svelte'
    import Fleet from './Fleet.svelte'
    import Goods from './Goods.svelte'
    import Orders from './Orders.svelte'
    import Resources from './Resources.svelte'
    import Techs from './Techs.svelte'

    const faction = $derived(playerArea.selectedFaction)

    function pick(next: MockFaction) {
        if (playerArea.sheetOpen && playerArea.selected === next.faction) {
            playerArea.sheetOpen = false
            return
        }
        playerArea.selected = next.faction
        playerArea.sheetOpen = true
    }
</script>

<div class="dock">
    {#if playerArea.sheetOpen}
        <div
            class="sheet"
            style:--faction={FACTION_FILL[faction.faction]}
            style:--ink={inkOn(faction.faction)}
            transition:fly={{ y: 40, duration: 160 }}
        >
            <div class="bar">
                <span class="title"
                    >{faction.you ? 'Your sheet' : `${faction.player}’s sheet`} · {factionName(
                        faction.faction
                    )}</span
                >
                <span class="turn">Initiative {faction.initiative} · {faction.step}</span>
                <span class="rank">{faction.rank}</span>
                <Coin value={faction.score} size={24} />
            </div>
            <div class="wells">
                <div class="well">
                    <Resources {faction} marker={26} />
                    <div class="note">
                        Next Earth production ${faction.production.cash}B and {faction.production.markers.join(
                            ', '
                        )} markers. Settlements ${faction.settlementCost}B each.
                    </div>
                    <h4>Earth trade goods <span>{faction.earthGoods.length} of 10</span></h4>
                    <Goods goods={faction.earthGoods} capacity={10} size={16} />
                    <h4>Techs</h4>
                    <Techs {faction} />
                </div>
                <div class="well">
                    <h4>Ships <span>{faction.ships.length} of {faction.maxShips}</span></h4>
                    <Fleet {faction} bySystem size={22} />
                </div>
                <div class="well">
                    <h4>
                        Bases <span
                            >{faction.bases.length} of {faction.maxBases} · {totalSettlements(
                                faction
                            )} settlements</span
                        >
                    </h4>
                    <Bases {faction} detail height={22} />
                    <h4>
                        Escalation <span class:bad={!faction.canAttack}
                            >{faction.canAttack ? 'may attack' : 'can’t attack'}</span
                        >
                    </h4>
                    <Escalation {faction} detail />
                </div>
                <div class="well">
                    <h4>
                        Cards {#if faction.you}<span>hand hidden from others</span>{/if}
                    </h4>
                    <div class="cards">
                        {#each faction.hand as card (card.name)}
                            <Card {card} width={112} showEffect />
                        {/each}
                    </div>
                    {#each faction.cards as card (card.name)}
                        <div class="owned" title={card.effect}>
                            <span>{card.name} ({card.level})</span><Coin
                                value={card.vp}
                                size={18}
                            />
                        </div>
                    {/each}
                    <h4>Orders</h4>
                    <Orders {faction} />
                </div>
            </div>
        </div>
    {/if}
    <div class="tabs" role="tablist" aria-label="Faction sheets">
        {#each MOCK_FACTIONS as tab (tab.faction)}
            {@const active = playerArea.sheetOpen && playerArea.selected === tab.faction}
            <button
                type="button"
                role="tab"
                aria-selected={active}
                class="tab"
                class:active
                style:--faction={FACTION_FILL[tab.faction]}
                style:--ink={inkOn(tab.faction)}
                title={factionName(tab.faction)}
                onclick={() => pick(tab)}
            >
                <img src={FACTION_ART[tab.faction]} alt="" width="20" height="20" />
                <span>{tab.you ? 'You' : tab.player}</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .dock {
        position: relative;
    }

    .sheet {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 100%;
        border-radius: 10px 10px 0 0;
        background: var(--faction);
        padding: 0 5px 5px;
        color: #dbe7f5;
    }

    .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 6px;
        color: var(--ink);
    }

    .title {
        font-size: 15px;
        font-weight: 800;
    }

    .turn {
        flex: 1;
        font-size: 13px;
    }

    .rank {
        font-size: 13px;
        font-weight: 700;
    }

    .tabs {
        display: flex;
        gap: 2px;
        padding: 0 8px 4px;
        border-top: 1px solid #22314d;
        background: #0a0f1b;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px 4px 8px;
        border: 1px solid #22314d;
        border-top: none;
        border-radius: 0 0 7px 7px;
        background: #111a2c;
        color: #b7c7de;
        font-size: 13.5px;
        font-weight: 600;
    }

    .tab img {
        border-radius: 3px;
    }

    .tab:hover {
        background: #1a2740;
        color: #e8f1ff;
    }

    .tab.active {
        border-color: var(--faction);
        background: var(--faction);
        color: var(--ink);
        font-weight: 800;
    }

    .wells {
        display: grid;
        grid-template-columns: 1fr 1.05fr 1.25fr 1.3fr;
        gap: 5px;
        height: 312px;
    }
    .well {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
        padding: 8px 9px;
        border-radius: 6px;
        background: #080c15;
        overflow-y: auto;
    }
    h4 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        color: #7fd3ff;
    }
    h4:not(:first-child) {
        margin-top: 4px;
    }
    h4 span {
        font-size: 12px;
        font-weight: 500;
        color: #8fa4c2;
        white-space: nowrap;
    }
    h4 span.bad {
        font-weight: 700;
        color: #ff8a7a;
    }
    .note {
        font-size: 12px;
        color: #8fa4c2;
    }
    .cards {
        display: flex;
        gap: 5px;
    }
    .owned {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12.5px;
    }
</style>
