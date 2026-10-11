<script lang="ts">
    // PROTOTYPE (variant A): everything about one faction, in plain labelled sections.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import { inkOn, totalSettlements, type MockFaction } from './campaignMock.svelte.js'
    import Bases from './Bases.svelte'
    import Card from './Card.svelte'
    import Coin from './Coin.svelte'
    import Escalation from './Escalation.svelte'
    import Fleet from './Fleet.svelte'
    import Goods from './Goods.svelte'
    import Orders from './Orders.svelte'
    import Resources from './Resources.svelte'
    import Techs from './Techs.svelte'

    let { faction }: { faction: MockFaction } = $props()
</script>

<div class="console">
    <div
        class="head"
        style:background={FACTION_FILL[faction.faction]}
        style:color={inkOn(faction.faction)}
    >
        <img src={FACTION_ART[faction.faction]} alt="" width="30" height="30" />
        <div class="who">
            <span class="faction">{factionName(faction.faction)}</span>
            <span class="player">{faction.you ? 'Your faction' : faction.player}</span>
        </div>
        <div class="turn">
            <span>Initiative {faction.initiative}</span>
            <span>{faction.step}</span>
        </div>
    </div>
    <div class="body">
        <Resources {faction} marker={30} score />

        <section>
            <h4>
                Bases <span
                    >{faction.bases.length} of {faction.maxBases} · {totalSettlements(faction)} settlements</span
                >
            </h4>
            <Bases {faction} detail />
        </section>

        <section>
            <h4>Ships <span>{faction.ships.length} of {faction.maxShips}</span></h4>
            <Fleet {faction} bySystem size={20} />
        </section>

        <section>
            <h4>
                Earth <span
                    >next production ${faction.production.cash}B · settlements ${faction.settlementCost}B
                    each</span
                >
            </h4>
            <div class="earth">
                <Goods goods={faction.earthGoods} capacity={10} size={16} />
                <span class="note">{faction.earthGoods.length} of 10 goods</span>
            </div>
        </section>

        <section>
            <h4>
                Cards {#if faction.you}<span>your hand is hidden from others</span>{/if}
            </h4>
            {#if faction.hand.length > 0}
                <div class="hand">
                    {#each faction.hand as card (card.name)}
                        <Card {card} width={140} showEffect />
                    {/each}
                </div>
            {/if}
            {#each faction.cards as card (card.name)}
                <div class="owned">
                    <span>{card.name} ({card.level})</span><Coin value={card.vp} size={18} />
                </div>
            {:else}
                <div class="note">No cards owned</div>
            {/each}
        </section>

        <section>
            <h4>Orders</h4>
            <Orders {faction} />
        </section>

        <section>
            <h4>
                Escalation <span class:bad={!faction.canAttack}
                    >{faction.canAttack ? 'may attack' : 'can’t attack'}</span
                >
            </h4>
            <Escalation {faction} detail />
        </section>

        <section>
            <h4>Techs</h4>
            <Techs {faction} />
        </section>

        <section>
            <h4>Score <span>{faction.rank}</span></h4>
            <details>
                <summary>{faction.score} points so far</summary>
                <div class="note">
                    Settlements, large bases, cards, titles, directives, kept markers, escalation,
                    influence, tech points and cash, less 5 per undeveloped tech.
                </div>
            </details>
        </section>

        <section>
            <details>
                <summary>Faction abilities</summary>
                <ol>
                    {#each faction.abilities as ability (ability)}<li>{ability}</li>{/each}
                </ol>
            </details>
        </section>
    </div>
</div>

<style>
    .console {
        border: 1px solid #1e2b44;
        border-radius: 8px;
        overflow: hidden;
        background: #0d1322;
        color: #dbe7f5;
    }
    .head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
    }
    .head img {
        border-radius: 3px;
    }
    .who {
        display: flex;
        flex-direction: column;
        flex: 1;
        line-height: 1.15;
    }
    .faction {
        font-size: 15px;
        font-weight: 800;
    }
    .player {
        font-size: 12.5px;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.2;
    }
    .body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
    }
    section {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-top: 8px;
        border-top: 1px solid #1a2438;
    }
    h4 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 13px;
        font-weight: 800;
        color: #7fd3ff;
    }
    h4 span {
        font-size: 12px;
        font-weight: 500;
        color: #8fa4c2;
    }
    h4 span.bad {
        font-weight: 700;
        color: #ff8a7a;
    }
    .earth {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .note {
        font-size: 12px;
        color: #8fa4c2;
    }
    .hand {
        display: flex;
        gap: 6px;
    }
    .owned {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12.5px;
    }
    summary {
        font-size: 12.5px;
        cursor: pointer;
    }
    ol {
        margin: 4px 0 0 16px;
        list-style: decimal;
        font-size: 12px;
        color: #b7c7de;
    }
</style>
