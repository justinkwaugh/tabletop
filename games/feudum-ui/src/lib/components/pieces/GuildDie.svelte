<script lang="ts">
    import { GuildById, type GuildId } from '@tabletop/feudum'
    import { RankBadges, type DieRank } from '$lib/model/guildDie.js'
    import { GuildIconPaths } from '$lib/utils/pieceShapes.js'

    /**
     * A guild as its progress-die face: the guild's one icon in ink on light wood. `rank` is the
     * badge on its corner, M, J, A or a dimmed dash for none; without it the die has no badge.
     * `caption` names the guild beneath it on a desk; a phone drops the caption, and the name stays
     * in the accessible name of whatever holds the die. `size` is the face's side on a desk,
     * `phoneSize` on a phone (contract: Phone layout).
     */
    let {
        guild,
        rank,
        size = 72,
        phoneSize = Math.min(size, 50),
        picked = false,
        caption = false
    }: {
        guild: GuildId
        rank?: DieRank
        size?: number
        phoneSize?: number
        picked?: boolean
        caption?: boolean
    } = $props()
</script>

<span
    class="die-face"
    style:--die-desk="{size}px"
    style:--die-phone="{phoneSize}px"
    data-die={guild}
    data-rank={rank}
>
    <span class="die" class:picked>
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={GuildIconPaths[guild]} fill-rule="evenodd"></path>
        </svg>
        {#if rank}
            <span class="badge" class:none={rank === 'none'} data-badge>{RankBadges[rank]}</span>
        {/if}
    </span>
    {#if caption}
        <span class="caption" data-die-caption>{GuildById[guild].name}</span>
    {/if}
</span>

<style>
    .die-face {
        --die: var(--die-desk);
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .die {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--die);
        height: var(--die);
        border: 2px solid var(--feudum-wood-dark);
        border-radius: calc(var(--die) * 0.18);
        background: linear-gradient(145deg, var(--feudum-parchment), var(--feudum-parchment-shade));
        box-shadow:
            inset 0 -3px 0 var(--feudum-parchment-shade),
            0 2px 3px var(--feudum-dim);
        color: var(--feudum-ink);
    }

    .die svg {
        width: 62%;
        height: 62%;
        fill: currentColor;
    }

    .die.picked {
        outline: 4px solid var(--feudum-accent);
        outline-offset: 2px;
    }

    .badge {
        position: absolute;
        right: -7px;
        bottom: -7px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: calc(var(--die) * 0.36);
        height: calc(var(--die) * 0.36);
        padding: 0 3px;
        border: 2px solid var(--feudum-accent);
        border-radius: 999px;
        background: var(--feudum-surface-raised);
        color: var(--feudum-accent);
        font-size: calc(var(--die) * 0.21);
        font-weight: 700;
        line-height: 1;
    }

    .badge.none {
        border-color: var(--feudum-text-muted);
        color: var(--feudum-text-muted);
    }

    .caption {
        font-size: 0.75rem;
        line-height: 1;
        color: var(--feudum-text-muted);
    }

    @media (max-width: 40rem), (max-height: 520px) and (orientation: landscape) {
        .die-face {
            --die: var(--die-phone);
        }

        .caption {
            display: none;
        }
    }
</style>
