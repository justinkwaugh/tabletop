<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        AUTOMATIC_DEVELOPMENT_HEADING,
        AUTOMATIC_DEVELOPMENT_NOTE_LINE,
        AUTOMATIC_DEVELOPMENT_ROW,
        automaticDevelopmentNote,
        boardLayout
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const map = $derived(state.map)
    const layout = $derived(boardLayout(map.id))
    const note = $derived(layout.automaticDevelopment)
    const free = $derived(map.definition.freeMetroDevelopment)
    const next = $derived(state.automaticDevelopmentTarget())
    // In order, numbered; the one that develops next is underlined.
    const places = $derived(
        map.definition.automaticDevelopment.map((settlementId, index) => ({
            id: settlementId,
            name: map.settlement(settlementId).name,
            y: AUTOMATIC_DEVELOPMENT_HEADING - 4 + index * AUTOMATIC_DEVELOPMENT_ROW
        }))
    )
    const noteLines = $derived(automaticDevelopmentNote(free))
    const noteY = $derived(
        AUTOMATIC_DEVELOPMENT_HEADING + places.length * AUTOMATIC_DEVELOPMENT_ROW - 2
    )
    const listX = $derived(note ? note.width / 2 - 70 : 0)
</script>

{#if note}
    <g
        transform="translate({note.x} {note.y})"
        aria-label="Automatic Metro Development order"
        text-rendering="geometricPrecision"
    >
        <text x={note.width / 2} y="16" class="title"
            >{free ? 'Free Metro Area' : 'Automatic Metro Development'}</text
        >
        {#each places as place, index (place.id)}
            <text x={listX} y={place.y} class="number">{index + 1}.</text>
            <text x={listX + 8} y={place.y} class="place" class:next={place.id === next}
                >{place.name}</text
            >
        {/each}
        {#each noteLines as line, index (index)}
            <text
                x={note.width / 2}
                y={noteY + index * AUTOMATIC_DEVELOPMENT_NOTE_LINE}
                class="body">{line}</text
            >
        {/each}
    </g>
{/if}

<style>
    .title {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #18222f;
        text-anchor: middle;
    }

    .number,
    .place {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 13.5px;
        fill: #18222f;
    }

    .number {
        text-anchor: end;
    }

    .next {
        font-weight: 700;
        text-decoration: underline;
    }

    .body {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 11.5px;
        font-style: italic;
        fill: #2f445c;
        text-anchor: middle;
    }
</style>
