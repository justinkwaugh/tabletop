<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MessageCard from './board/MessageCard.svelte'

    const gameSession = getGameSession()

    const reading = $derived(
        gameSession.readableMessages.find((card) => card.messageId === gameSession.readingMessage)
    )
    const browsable = $derived(gameSession.readableMessages.length > 1)
</script>

{#if reading}
    <div class="backdrop" role="presentation" onclick={() => gameSession.readMessage(undefined)}>
        <div class="dialog" role="dialog" aria-label="Message card">
            <div class="faces">
                {#if reading.faces}
                    Die roll {reading.faces.join(' – ')}
                {:else}
                    This year's message
                {/if}
            </div>
            <div class="row">
                {#if browsable}
                    <button
                        type="button"
                        class="arrow"
                        aria-label="Previous card"
                        onclick={(event) => {
                            event.stopPropagation()
                            gameSession.readNeighbourMessage(-1)
                        }}>‹</button
                    >
                {/if}
                <MessageCard messageId={reading.messageId} width={300} />
                {#if browsable}
                    <button
                        type="button"
                        class="arrow"
                        aria-label="Next card"
                        onclick={(event) => {
                            event.stopPropagation()
                            gameSession.readNeighbourMessage(1)
                        }}>›</button
                    >
                {/if}
            </div>
            <button type="button" class="close" onclick={() => gameSession.readMessage(undefined)}
                >Close</button
            >
        </div>
    </div>
{/if}

<style>
    .backdrop {
        position: absolute;
        z-index: 20;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(30, 20, 10, 0.45);
    }

    .dialog {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .faces {
        border-radius: 999px;
        background: #fff6dc;
        padding: 0 14px;
        color: #4a2c16;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 22px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .arrow {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: #fff6dc;
        color: #4a2c16;
        font-size: 28px;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }

    .arrow:hover {
        background: #ffffff;
    }

    .close {
        border-radius: 999px;
        background: #fff6dc;
        padding: 2px 16px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 18px;
    }
</style>
