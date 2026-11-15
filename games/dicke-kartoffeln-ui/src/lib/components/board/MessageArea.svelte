<script lang="ts">
    import {
        MESSAGE_SPACE_FACES,
        MESSAGE_SPACE_IDS,
        type MessageId
    } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MessageCard from './MessageCard.svelte'

    let { cardWidth, onRead }: { cardWidth: number; onRead: (messageId: MessageId) => void } =
        $props()

    const gameSession = getGameSession()

    const messages = $derived(gameSession.gameState.messages)
</script>

{#if messages}
    <div class="messages">
        {#each MESSAGE_SPACE_IDS as space (space)}
            {@const messageId = messages.messageOn(space)}
            <div class="space">
                <div class="faces">{MESSAGE_SPACE_FACES[space].join(' – ')}</div>
                <button type="button" class="read" onclick={() => onRead(messageId)}>
                    <MessageCard {messageId} width={cardWidth} />
                </button>
            </div>
        {/each}
        <div class="space current">
            <div class="faces">This year</div>
            {#if messages.current}
                {@const current = messages.current}
                <button type="button" class="read" onclick={() => onRead(current)}>
                    <MessageCard messageId={current} width={cardWidth} />
                </button>
            {:else}
                <div class="empty" style:width="{cardWidth}px" style:height="{cardWidth * 1.45}px">
                    No news yet
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .messages {
        display: flex;
        justify-content: space-between;
        gap: 6px;
    }

    .space {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .faces {
        color: #4a2c16;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 18px;
    }

    .space.current {
        border: 2px solid #9b2a22;
        border-radius: 12px;
        background: rgba(155, 42, 34, 0.1);
        padding: 0 4px 5px;
    }

    .current .faces {
        color: #9b2a22;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .current .read {
        box-shadow:
            0 0 0 2px #9b2a22,
            0 0 14px rgba(190, 50, 30, 0.55);
    }

    .read {
        border-radius: 10px;
        transition: transform 120ms ease-out;
    }

    .read:hover {
        transform: translateY(-3px);
    }

    .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px dashed #b8a882;
        border-radius: 12px;
        color: #8a7a5a;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 16px;
    }
</style>
