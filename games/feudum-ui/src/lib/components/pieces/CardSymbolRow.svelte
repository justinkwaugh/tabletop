<script lang="ts">
    import type { ActionCard } from '@tabletop/feudum'
    import { StarPath } from '$lib/utils/pieceShapes.js'

    /** R-3.4 A card's corner symbols, right to left. */
    let {
        card,
        right,
        y,
        unit = 30
    }: { card: ActionCard; right: number; y: number; unit?: number } = $props()

    interface Mark {
        readonly name: string
        readonly value?: string
    }

    let marks = $derived.by((): Mark[] => {
        const list: Mark[] = []
        if (card.symbols.replay) {
            list.push({ name: card.symbols.replay })
        }
        if (card.symbols.notLast) {
            list.push({ name: 'not-last' })
        }
        if (card.symbols.eitherOr) {
            list.push({ name: 'either-or' })
        }
        if (card.symbols.icon) {
            list.push({ name: card.symbols.icon })
        }
        if (card.vp) {
            list.push({ name: 'vp', value: card.vp === 'variable' ? '?' : card.vp.join('/') })
        }
        return list
    })
    let scale = $derived(unit / 24)
</script>

{#each marks as mark, index (mark.name)}
    <g
        transform="translate({right - (index + 1) * (unit + 2)} {y}) scale({scale})"
        aria-label={mark.name}
    >
        <title>{mark.name}</title>
        <circle
            cx="12"
            cy="12"
            r="11.5"
            fill="var(--feudum-parchment-shade)"
            stroke="var(--feudum-ink)"
        ></circle>
        {#if mark.name === 'x2' || mark.name === 'crossed-x2'}
            <path d="M5 8 L11 16 M11 8 L5 16" stroke="var(--feudum-ink)" stroke-width="1.8"></path>
            <text
                x="16"
                y="17"
                text-anchor="middle"
                font-size="11"
                font-weight="700"
                fill="var(--feudum-ink)">2</text
            >
            {#if mark.name === 'crossed-x2'}
                <path d="M3 21 L21 3" stroke="var(--feudum-ink)" stroke-width="2"></path>
            {/if}
        {:else if mark.name === 'not-last'}
            <path
                d="M6 12 L15 12 M12 8 L16 12 L12 16 M19 6 L19 18"
                fill="none"
                stroke="var(--feudum-ink)"
                stroke-width="1.8"
            ></path>
            <path d="M4 20 L20 4" stroke="var(--feudum-ink)" stroke-width="1.2"></path>
        {:else if mark.name === 'either-or'}
            <path
                d="M4 12 L10 12 L18 6 M10 12 L18 18"
                fill="none"
                stroke="var(--feudum-ink)"
                stroke-width="1.8"
            ></path>
        {:else if mark.name === 'epic-voyage'}
            <path
                d="M4 15 L20 15 L17 19 L7 19 Z M11 4 L13 4 L13 14 L11 14 Z M14 6 L19 13 L14 13 Z"
                fill="var(--feudum-ink)"
            ></path>
        {:else if mark.name === 'region-tile'}
            <rect
                x="6"
                y="6"
                width="12"
                height="12"
                rx="2"
                fill="none"
                stroke="var(--feudum-ink)"
                stroke-width="2"
            ></rect>
        {:else}
            <path
                d={StarPath}
                transform="translate(3 3) scale(0.75)"
                fill="var(--feudum-parchment)"
                stroke="var(--feudum-ink)"
            ></path>
            <text
                x="12"
                y="16"
                text-anchor="middle"
                font-size={(mark.value?.length ?? 0) > 2 ? 7 : 11}
                font-weight="700"
                fill="var(--feudum-ink)">{mark.value}</text
            >
        {/if}
    </g>
{/each}
