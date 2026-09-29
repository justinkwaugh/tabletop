<script lang="ts">
    import { range } from '@tabletop/common'
    import { plural } from '$lib/model/names.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import { endDieIsRolled } from '@tabletop/oath'
    import { attackFaceImage, defenseFaceImage, endDieImage } from '$lib/images/diceImages.js'
    import { lastEndDieRoll } from '$lib/model/actionLog.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.5.3 pools while the defender answers, then R-5.5.4 and R-5.5.5 faces; R-3.3's end die beside.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let campaign = $derived(gameState.campaign)

    let unrolled = $derived(!!campaign?.pendingDefenderPlans)

    let endDieLive = $derived(endDieIsRolled(gameState))
    let lastEndDie = $derived(lastEndDieRoll(gameSession.actions))
</script>

{#snippet unrolledDice(count: number, side: 'attack' | 'defense')}
    {#each range(0, count) as index (index)}
        <span
            class="die die--unrolled"
            class:die--attack={side === 'attack'}
            class:die--defense={side === 'defense'}
            title="{side === 'attack' ? 'Attack' : 'Defense'} die, not yet rolled"
        ></span>
    {/each}
{/snippet}

{#if campaign}
    <section class="group" title="the Campaign's dice">
        <!-- "vs", not a verb: `PlayerName` prints "you" for the viewer. -->
        <h3>
            <PlayerName playerId={campaign.attackerPlayerId} /> vs
            {#if campaign.defenderPlayerId}<PlayerName
                    playerId={campaign.defenderPlayerId}
                />{:else}the bandits{/if}
        </h3>
        <div class="dice">
            {#if unrolled}
                {@render unrolledDice(campaign.attackPool, 'attack')}
                <span class="dice__sep"></span>
                {@render unrolledDice(campaign.defensePool, 'defense')}
                <span class="dice__total">waiting on the defender</span>
            {:else}
                {#each campaign.attackRoll as face, index (index)}
                    <span
                        class="die"
                        title={face.skulls > 0
                            ? 'Skull and two swords — a warband of yours dies'
                            : face.hollowSwords > 0
                              ? 'Hollow sword — two make one sword'
                              : 'Sword'}
                    >
                        <img src={attackFaceImage(face)} alt="" />
                    </span>
                {/each}
                <span class="dice__total">{campaign.swords} swords</span>
                <span class="dice__sep"></span>
                {#each campaign.defenseRoll as face, index (index)}
                    <span
                        class="die"
                        title={face.doubling
                            ? 'Doubles the shields rolled'
                            : face.shields === 0
                              ? 'Blank'
                              : plural(face.shields, 'shield')}
                    >
                        <img src={defenseFaceImage(face)} alt="" />
                    </span>
                {/each}
                <span class="dice__total">{campaign.defense} defense</span>
            {/if}
        </div>
    </section>
{/if}

{#if endDieLive || lastEndDie !== undefined}
    <section class="group" title="the end die, rolled at the close of each round from round 5">
        <h3>End die</h3>
        <div class="dice">
            {#if lastEndDie !== undefined}
                <span class="die" title="Last rolled {lastEndDie}">
                    <img src={endDieImage(lastEndDie)} alt="" />
                </span>
                <span class="dice__total">last {lastEndDie}</span>
            {:else}
                <span class="die die--unrolled die--end" title="Live — not yet rolled"></span>
                <span class="dice__total">live</span>
            {/if}
        </div>
    </section>
{/if}

<style>
    .group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    h3 {
        margin: 0;
        color: rgba(253, 230, 138, 0.72);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        max-width: 900px;
    }

    .die {
        display: block;
        width: 72px;
        height: 72px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        overflow: hidden;
        background: transparent;
        line-height: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
    }

    .die img {
        display: block;
        width: 100%;
        height: 100%;
    }

    .die--unrolled {
        border: 2px dashed rgba(255, 255, 255, 0.45);
        opacity: 0.75;
    }

    .die--attack {
        background: #d64e0c;
    }

    .die--defense {
        background: #0a8fd6;
    }

    .die--end {
        background: #9c66a0;
    }

    .dice__sep {
        width: 14px;
    }

    .dice__total {
        margin-left: 6px;
        font-size: 26px;
        color: #a8a29e;
        white-space: nowrap;
    }
</style>
