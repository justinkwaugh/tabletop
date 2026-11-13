<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        RULES_REMINDER_HEADING,
        RULES_REMINDER_LINE,
        RULES_REMINDER_NOTE_GAP,
        boardLayout
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
    const panel = $derived(layout.rulesPanel)
    const notes = $derived(layout.spec.rules?.notes ?? [])
    // Each note's first baseline, below the heading and the notes before it.
    const tops = $derived(
        notes.map(
            (_, index) =>
                RULES_REMINDER_HEADING +
                notes
                    .slice(0, index)
                    .reduce(
                        (sum, note) =>
                            sum + note.length * RULES_REMINDER_LINE + RULES_REMINDER_NOTE_GAP,
                        0
                    )
        )
    )
</script>

{#if panel}
    <g
        transform="translate({panel.x} {panel.y})"
        aria-label="{layout.spec.title} rules"
        text-rendering="geometricPrecision"
    >
        <rect width={panel.width} height={panel.height} rx="8" class="sheet"></rect>
        <text x={panel.width / 2} y="22" class="title">{layout.spec.title} Rules</text>
        <text x={panel.width / 2} y="38" class="subtitle"
            >where they differ from South African Railroads</text
        >
        <line x1="12" x2={panel.width - 12} y1="45" y2="45" class="rule"></line>
        {#each notes as note, index (index)}
            <text x="14" y={tops[index] + 10} class="bullet">•</text>
            {#each note as line, row (row)}
                <text x="26" y={tops[index] + 10 + row * RULES_REMINDER_LINE} class="body"
                    >{line}</text
                >
            {/each}
        {/each}
    </g>
{/if}

<style>
    .sheet {
        fill: #f7efd9;
        stroke: #384f6c;
        stroke-width: 2;
    }

    .title {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        fill: #18222f;
        text-anchor: middle;
    }

    .subtitle {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
        fill: #2f445c;
        text-anchor: middle;
    }

    .rule {
        stroke: #577ba8;
        stroke-width: 1;
    }

    .bullet,
    .body {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 12px;
        fill: #18222f;
    }
</style>
