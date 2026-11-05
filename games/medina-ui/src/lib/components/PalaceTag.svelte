<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import PieceIcon from './PieceIcon.svelte'

    let { container }: { container: HTMLDivElement } = $props()

    const session = getGameSession()

    const TAG_WIDTH = 250
    const EDGE = 6
    const GAP = 8
    const TAG_HEIGHT = 84

    const palace = $derived(
        session.focusedPalaceId ? session.pieceState.palace(session.focusedPalaceId) : undefined
    )
    const score = $derived(palace ? session.pieceState.palaceScore(palace) : undefined)
    const owner = $derived(palace?.rooftop?.playerId)

    const place = $derived.by(() => {
        const palaceId = session.focusedPalaceId
        const board = session.boardElement
        if (!palaceId || !board) {
            return undefined
        }
        const rects = [...board.querySelectorAll(`[data-palace="${palaceId}"]`)].map((part) =>
            part.getBoundingClientRect()
        )
        if (rects.length === 0) {
            return undefined
        }
        const frame = container.getBoundingClientRect()
        const left = Math.min(...rects.map((rect) => rect.left))
        const right = Math.max(...rects.map((rect) => rect.right))
        const top = Math.min(...rects.map((rect) => rect.top))
        const center = (left + right) / 2 - frame.left
        return {
            left: Math.max(EDGE, Math.min(frame.width - TAG_WIDTH - EDGE, center - TAG_WIDTH / 2)),
            top: Math.max(EDGE, top - frame.top - TAG_HEIGHT - GAP)
        }
    })

    function count(value: number, word: string, plural = `${word}s`): string[] {
        return value > 0 ? [`${value} ${value === 1 ? word : plural}`] : []
    }

    const parts = $derived(
        score
            ? [
                  ...count(score.buildings, 'block'),
                  ...count(score.stables, 'stable'),
                  ...count(score.merchants, 'merchant'),
                  ...count(score.walls, 'wall section'),
                  ...(score.well > 0 ? [`well +${score.well}`] : [])
              ]
            : []
    )
</script>

{#if palace && score && place}
    <div
        class="tag"
        style:left="{place.left}px"
        style:top="{place.top}px"
        style:width="{TAG_WIDTH}px"
    >
        <div class="heading">
            {#if palace.rooftop}
                <PieceIcon
                    name="{session.rooftopSprite(palace.rooftop)}-0"
                    height={18}
                    maxWidth={24}
                />
            {/if}
            <span class="who">
                {#if owner}
                    {session.getPlayerName(owner)}
                {:else if palace.rooftop}
                    Neutral
                {:else}
                    Unclaimed
                {/if}
            </span>
            <b>{score.total}</b>
        </div>
        <div class="size">Size {score.buildings + score.stables}</div>
        <div class="parts">{parts.join(' · ')}</div>
    </div>
{/if}

<style>
    .tag {
        position: absolute;
        z-index: 4;
        padding: 7px 11px;
        border-radius: 5px;
        background: #231610;
        color: #e6c595;
        pointer-events: none;
        box-shadow: 0 3px 8px rgb(0 0 0 / 0.4);
    }

    .who,
    .heading b {
        position: relative;
        top: 3px;
    }

    .heading {
        display: flex;
        align-items: center;
        gap: 7px;
        font:
            700 17px/1.1 'Medina Display',
            Georgia,
            serif;
    }

    .who {
        flex: 1;
        min-width: 0;
    }

    .heading b {
        font-size: 23px;
    }

    .size {
        margin-top: 3px;
        font:
            700 16px/1.1 'Medina Display',
            Georgia,
            serif;
    }

    .parts {
        margin-top: 2px;
        color: #b39a76;
        font:
            400 15px/1.25 'Medina Body',
            system-ui,
            sans-serif;
    }
</style>
