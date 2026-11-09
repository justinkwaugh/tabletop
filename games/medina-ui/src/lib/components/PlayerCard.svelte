<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        PALACE_COLORS,
        type HydratedMedinaPlayerState,
        type PlayerScore
    } from '@tabletop/medina'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { ROOFTOP_SPRITE_NEUTRAL } from '$lib/model/session.svelte'
    import { COLOR_NAMES } from '$lib/utils/describeAction.js'
    import Niche from './Niche.svelte'
    import PieceIcon from './PieceIcon.svelte'
    import PieceInNiche from './PieceInNiche.svelte'
    import TileChip from './TileChip.svelte'

    let {
        player,
        score
    }: {
        player: HydratedMedinaPlayerState
        score: PlayerScore
    } = $props()

    const SMALL_PIECE_HEIGHT = 15
    const SMALL_PIECE_WIDTH = 20

    const session = getGameSession()
    const state = $derived(session.gameState)
    const playerId = $derived(player.playerId)
    const color = $derived(session.colors.getPlayerUiColor(playerId))
    const textColor = $derived(session.colors.getPlayerTextColorValue(playerId))
    const active = $derived(state.activePlayerIds.includes(playerId))
    const status = $derived.by(() => {
        if (state.result) {
            return undefined
        }
        if (player.tookTeaBreak) {
            return 'tea'
        }
        return active ? 'placing' : undefined
    })
    const rooftop = $derived(`${session.rooftopSprite({ coords: { x: 0, y: 0 }, playerId })}-0`)
    const showCounts = $derived(session.showsPieceCounts(playerId))

    const plots = $derived(
        PALACE_COLORS.map((palaceColor) => ({
            color: palaceColor,
            left: player.buildings?.[palaceColor] ?? 0,
            value: score.palaces.find((palace) => palace.color === palaceColor)?.total
        }))
    )
</script>

<section class="card" class:active style:--c={color} style:--on={textColor}>
    <div class="parapet">
        <span class="crest">
            <Niche height={58} rim="rgb(0 0 0 / 0.32)" fill="#120c08">
                <PieceInNiche name={rooftop} fitWidth={34} fitHeight={32} floor={54} />
            </Niche>
        </span>
        <span class="name">
            <PlayerName {playerId} backgroundOpacity={0} additionalClasses="!p-0 !text-[inherit]" />
        </span>
        {#if status}<span class="placing">{status}</span>{/if}
        <span class="score" title="Score so far">{score.total}</span>
    </div>
    <div class="keep">
        <div class="plots">
            {#each plots as plot (plot.color)}
                {@const claimed = plot.value !== undefined}
                <div class="plot">
                    <Niche height={58} rim={claimed ? color : '#7f5228'} fill="#120c08">
                        <g class:spent={showCounts && plot.left === 0}>
                            <PieceInNiche
                                name="tall-{plot.color}-0"
                                fitWidth={36}
                                fitHeight={39}
                                floor={54}
                            />
                        </g>
                    </Niche>
                    {#if showCounts}
                        <span class="under">
                            <span
                                class="count"
                                class:none={plot.left === 0}
                                title="{plot.left} {COLOR_NAMES[plot.color]} buildings in hand"
                            >
                                {plot.left}
                            </span>
                            {#if claimed}
                                <PieceIcon
                                    name={rooftop}
                                    height={SMALL_PIECE_HEIGHT}
                                    maxWidth={SMALL_PIECE_WIDTH}
                                    title="Claimed, scoring {plot.value}"
                                />
                            {/if}
                        </span>
                    {/if}
                </div>
            {/each}
        </div>
        <div class="stock">
            <span class="item">
                <PieceIcon name={rooftop} height={19} maxWidth={24} title="Rooftops" />
                <b>{player.rooftops}</b>
            </span>
            {#if player.neutralRooftops > 0}
                <span class="item">
                    <PieceIcon
                        name="{ROOFTOP_SPRITE_NEUTRAL}-0"
                        height={19}
                        maxWidth={24}
                        title="Neutral rooftops"
                    />
                    <b>{player.neutralRooftops}</b>
                </span>
            {/if}
            {#if showCounts}
                <span class="item">
                    <PieceIcon name="stable-0" height={20} maxWidth={24} title="Stables" />
                    <b>{player.stables}</b>
                </span>
                <span class="item">
                    <PieceIcon name="merchant-0" height={23} maxWidth={20} title="Merchants" />
                    <b>{player.merchants}</b>
                </span>
                <span class="item">
                    <PieceIcon name="wall-h-0" height={19} maxWidth={27} title="Walls" />
                    <b>{player.walls}</b>
                </span>
            {/if}
            {#if player.teaTiles > 0}
                <span class="item">
                    <TileChip pixelHeight={26} name="tea" title="Tea tiles" />
                    <b>{player.teaTiles}</b>
                </span>
            {/if}
        </div>
    </div>
</section>

<style>
    .card {
        position: relative;
        margin-top: 9px;
    }

    .card::before {
        content: '';
        position: absolute;
        top: -9px;
        right: 0;
        left: 0;
        height: 10px;
        background: repeating-linear-gradient(90deg, var(--c) 0 15px, transparent 15px 26px);
    }

    .parapet {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 46px;
        padding: 6px 12px 7px 8px;
        background: var(--c);
        color: var(--on);
    }

    .crest {
        position: relative;
        top: -4px;
        flex: none;
        width: 36px;
        margin: -3px 0 -7px -1px;
    }

    .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        position: relative;
        top: 3px;
        font:
            700 23px/1.25 'Medina Display',
            Georgia,
            serif;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .placing {
        position: relative;
        top: 3px;
        opacity: 0.9;
        font:
            700 15px/1 'Medina Body',
            system-ui,
            sans-serif;
    }

    .score {
        position: relative;
        top: 3px;
        font:
            700 31px/1 'Medina Display',
            Georgia,
            serif;
    }

    .keep {
        display: grid;
        gap: 7px;
        padding: 9px 10px 0;
        background: #231610;
    }

    .card.active .keep {
        background: #2f1f17;
    }

    .plots {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
    }

    .plot {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
    }

    .spent {
        opacity: 0.3;
    }

    .under {
        display: flex;
        gap: 5px;
        align-items: baseline;
        justify-content: center;
        height: 28px;
        margin-top: 4px;
    }

    .count {
        color: #e6c595;
        font:
            700 22px/1 'Medina Display',
            Georgia,
            serif;
    }

    .count.none {
        opacity: 0.4;
    }

    .stock {
        display: flex;
        margin: 0 -10px;
        border-top: 1px solid #47332a;
        background: #160e09;
    }

    .item {
        display: flex;
        flex: 1 1 auto;
        gap: 6px;
        align-items: center;
        justify-content: center;
        height: 38px;
        padding: 0 3px;
    }

    .item + .item {
        border-left: 1px solid #33241b;
    }

    .item b {
        padding-top: 3px;
        color: #e6c595;
        font:
            700 19px/1 'Medina Display',
            Georgia,
            serif;
    }
</style>
