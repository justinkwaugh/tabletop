<script lang="ts">
    import { range } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import type { CampaignState } from '@tabletop/oath'
    import { attackFaceImage, defenseFaceImage } from '$lib/images/diceImages.js'
    import { plural } from '$lib/model/names.js'

    // R-5.5.3 pools while the defender answers, then R-5.5.4 and R-5.5.5 faces and totals.
    let { campaign }: { campaign: CampaignState } = $props()

    let unrolled = $derived(!!campaign.pendingDefenderPlans)
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

<section class="campaign-dice mb-2" aria-label="the Campaign's dice">
    <!-- "vs", not a verb: `PlayerName` prints "you" for the viewer. -->
    <div class="text-[11px] uppercase tracking-[0.2em] text-rose-200/80 mb-1">
        <PlayerName playerId={campaign.attackerPlayerId} /> vs
        {#if campaign.defenderPlayerId}<PlayerName playerId={campaign.defenderPlayerId} />{:else}the
            bandits{/if}
    </div>
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
            <span class="dice__total">{plural(campaign.swords, 'sword')}</span>
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

<style>
    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }
    .die {
        display: block;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        overflow: hidden;
        line-height: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
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
    .dice__sep {
        width: 10px;
    }
    .dice__total {
        margin-left: 4px;
        font-size: 13px;
        color: #d6d3d1;
        white-space: nowrap;
    }
</style>
