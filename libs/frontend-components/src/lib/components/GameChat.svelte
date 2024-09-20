<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte'
    import { GameChatMessage } from '@tabletop/common'
    import { Input, Button, Textarea } from 'flowbite-svelte'
    import { FaceGrinSolid } from 'flowbite-svelte-icons'
    import { nanoid } from 'nanoid'
    import { getContext } from 'svelte'
    import TimeAgo from 'javascript-time-ago'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as GameSession
    let chatService = gameSession.chatService
    let text: string = $state('')
    let input: HTMLTextAreaElement

    let messages: GameChatMessage[] = $derived.by(() => {
        return chatService.currentGameChat?.messages ?? []
    })

    let playerInitials: Record<string, string> = $derived.by(() => {
        return gameSession.game.players.reduce(
            (acc, player) => {
                acc[player.id] = player.name[0].toUpperCase()
                return acc
            },
            {} as Record<string, string>
        )
    })

    function sizeInput(event: Event) {
        const target = event.target as HTMLTextAreaElement
        if (!target) {
            return
        }
        setHiddenValue(target.value)
    }

    function setHiddenValue(text: string) {
        if (!input.parentNode) {
            return
        }
        const parent = input.parentNode as HTMLElement
        parent.dataset.replicatedValue = text
    }

    function sendMessage() {
        const message: GameChatMessage = {
            id: nanoid(),
            playerId: gameSession.myPlayer?.id,
            timestamp: new Date(),
            text
        }
        try {
            chatService.sendGameChatMessage(message, gameSession.game.id)
            input.value = ''
            setHiddenValue('')
        } catch (error) {
            console.error(error)
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            sendMessage()
        }
    }
</script>

{#snippet chatMessage(message: GameChatMessage)}
    <div class="flex flex-row justify-start items-start gap-x-2">
        <div
            class="shrink-0 grow-0 flex justify-center items-center rounded-full {gameSession.getPlayerBgColor(
                message.playerId
            )} {gameSession.getPlayerTextColor(
                message.playerId
            )} w-[32px] h-[32px] text-xl font-bold"
        >
            {playerInitials[message.playerId ?? 'unknown'] ?? ''}
        </div>
        <div class="flex flex-col justify-center items-start">
            <p class="text-xs text-gray-600">{timeAgo.format(message.timestamp)}</p>
            <p class="text-gray-200 leading-[1.1rem]">{message.text}</p>
        </div>
    </div>
{/snippet}

<div
    class="flex flex-col justify-end items-center w-full p-2 rounded-lg border-gray-700 border-2 gap-y-4 h-full text-sm sm:h-[calc(100dvh-174px)] h-[calc(100dvh-198px)] overflow-hidden"
>
    <div class="w-full fit-content overflow-scroll">
        <div class="flex flex-col justify-end items-start text-white w-full gap-y-4">
            {#each messages as message (message.id)}
                {@render chatMessage(message)}
            {/each}
        </div>
    </div>
    <div class="grow-0 flex flex-row justify-between items-center w-full gap-x-2 text-sm">
        <div class="grow-wrap w-full">
            <textarea
                bind:this={input}
                bind:value={text}
                maxlength="500"
                class="w-full rounded-lg bg-gray-50 dark:bg-gray-700
                text-gray-900 dark:placeholder-gray-400 dark:text-white border
                dark:border-gray-600 focus:border-primary-500 dark:focus:ring-primary-500
                dark:focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                oninput={sizeInput}
                onkeyup={(event) => handleKeyDown(event)}
                rows="1"
                name="message"
                placeholder=""
            ></textarea>
        </div>
        <Button onclick={() => sendMessage()} size="sm" class="w-[60px]" type="submit">Send</Button>
    </div>
</div>

<style>
    .grow-wrap {
        /* easy way to plop the elements on top of each other and have them both sized based on the tallest one's height */
        display: grid;
    }
    .grow-wrap::after {
        /* Note the weird space! Needed to preventy jumpy behavior */
        content: attr(data-replicated-value) ' ';

        /* This is how textarea text behaves */
        white-space: pre-wrap;

        /* Hidden from view, clicks, and screen readers */
        visibility: hidden;
    }
    :global(.grow-wrap > textarea) {
        /* You could leave this, but after a user resizes, then it ruins the auto sizing */
        resize: none;
        font: inherit;
        /* Firefox shows scrollbar on growth, you can hide like this. */
        overflow: hidden;
    }
    :global(.grow-wrap > textarea, .grow-wrap::after) {
        /* Identical styling required!! */
        padding: 0.625rem;
        max-height: 200px;

        /* Place on top of each other */
        grid-area: 1 / 1 / 2 / 2;
    }
</style>
