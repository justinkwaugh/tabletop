<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte'
    import { GameChatMessage } from '@tabletop/common'
    import { Button } from 'flowbite-svelte'
    import { nanoid } from 'nanoid'
    import { getContext, onMount } from 'svelte'
    import TimeAgo from 'javascript-time-ago'
    import { flip } from 'svelte/animate'
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import type { ChatEvent } from '$lib/services/chatService'
    import EmojiPicker from './EmojiPicker.svelte'
    import emojiRegex from 'emoji-regex'

    let {
        height = 'h-[calc(100dvh-198px)] sm:h-[calc(100dvh-174px)]',
        timeColor = 'text-gray-600',
        bgColor = 'bg-transparent',
        inputBgColor = 'bg-gray-700',
        inputBorderColor = 'border-gray-500'
    }: {
        height?: string
        timeColor?: string
        bgColor?: string
        inputBgColor?: string
        inputBorderColor?: string
    } = $props()
    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as GameSession
    let chatService = gameSession.chatService
    let text: string = $state('')
    let input: HTMLTextAreaElement
    let messagePanel: HTMLDivElement
    let lastCursorPosition: number = -1

    let messages: GameChatMessage[] = $derived.by(() => {
        return (chatService.currentGameChat?.messages ?? []).toSorted(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        )
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
        if (!gameSession.myPlayer) {
            return
        }

        text = text.trim()

        if (text === '') {
            return
        }

        const message: GameChatMessage = {
            id: nanoid(),
            playerId: gameSession.myPlayer?.id,
            timestamp: new Date(),
            text
        }
        try {
            chatService.sendGameChatMessage(message, gameSession.game.id)

            input.value = ''
            text = ''
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

    function textSplit(text: string) {
        const splitText = text.trim().split('\n')
        for (let i = 0; i < splitText.length; i++) {
            if (splitText[i].length === 0) {
                splitText[i] = '\u00A0'
            }
        }

        return splitText
    }

    async function chatListener(event: ChatEvent) {
        if (messagePanel.scrollTop === 0) {
            chatService.setGameChatBookmark(event.message.timestamp)
        }
    }

    onMount(() => {
        chatService.addListener(chatListener)
        chatService.markLatestRead()

        return () => {
            chatService.removeListener(chatListener)
        }
    })

    function scrollToBottom() {
        messagePanel.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function onScroll(event: Event) {
        if ((event.target as HTMLDivElement).scrollTop === 0) {
            if (messages.length > 0) {
                chatService.setGameChatBookmark(messages[0]?.timestamp)
            }
        }
    }

    function onEmojiPick(selection: any) {
        lastCursorPosition = input.selectionStart
        const textBefore = text.slice(0, lastCursorPosition)
        const textAfter = text.slice(lastCursorPosition)
        text = textBefore + selection.emoji + textAfter
    }

    function onEmojiHide() {
        if (input) {
            input.focus()
            if (lastCursorPosition < 0) {
                return
            }
            input.setSelectionRange(lastCursorPosition + 1, lastCursorPosition + 1)
        }
        lastCursorPosition = -1
    }

    function getSpansForText(text: string) {
        const spans: [string, boolean][] = []
        const matches = text.matchAll(emojiRegex())
        let lastMatchIndex = 0
        for (const match of matches) {
            const emoji = match[0]
            const index = match.index
            const before = text.slice(lastMatchIndex, index)
            if (before.length > 0) {
                spans.push([before, false])
            }
            spans.push([emoji, true])
            lastMatchIndex = index + emoji.length
        }

        const after = text.slice(lastMatchIndex)
        if (after.length > 0) {
            spans.push([after, false])
        }

        return spans
    }
</script>

{#snippet newMessageIndicator()}
    <button
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 21 }}
        onclick={() => scrollToBottom()}
        class="rounded-full bg-blue-700 text-gray-200 px-3 py-2 text-xs"
    >
        New Messages {'\u2193'}
    </button>
{/snippet}

{#snippet chatMessage(message: GameChatMessage)}
    <div class="flex flex-row justify-start items-start gap-x-2 hover:bg-gray-800 py-2">
        <div
            class="shrink-0 grow-0 flex justify-center items-center rounded-full {gameSession.getPlayerBgColor(
                message.playerId
            )} {gameSession.getPlayerTextColor(
                message.playerId
            )} w-[36px] h-[36px] text-xl font-bold"
        >
            {playerInitials[message.playerId ?? 'unknown'] ?? ''}
        </div>
        <div class="flex flex-col justify-center items-start">
            <p class="text-xs {timeColor}">{timeAgo.format(message.timestamp)}</p>
            {#each textSplit(message.text) as text}
                <p class="text-gray-200">
                    {#each getSpansForText(text) as span}
                        {#if span[1]}
                            <span class="text-2xl leading-none align-middle">{span[0]}</span>
                        {:else}
                            {span[0]}
                        {/if}
                    {/each}
                </p>
            {/each}
        </div>
    </div>
{/snippet}

<div
    class="relative flex flex-col justify-end items-center w-full p-2 rounded-lg border-gray-700 border-2 gap-y-2 text-sm {bgColor} {height} overflow-hidden"
>
    {#if chatService.hasUnreadMessages && messagePanel && messagePanel.scrollTop !== 0}
        <div class="absolute top-4 left-0 w-full z-10 flex justify-center">
            {@render newMessageIndicator()}
        </div>
    {/if}
    <div
        bind:this={messagePanel}
        onscroll={onScroll}
        class="w-full fit-content overflow-auto flex flex-col-reverse"
        style="overflow-anchor:auto"
    >
        <div class="flex flex-col-reverse justify-end items-start text-white w-full">
            {#each messages as message (message.id)}
                <div
                    in:fade={{ duration: 200, easing: quartIn }}
                    animate:flip={{ duration: 100 }}
                    class="w-full"
                    style="transform: translateZ(0);"
                >
                    {@render chatMessage(message)}
                </div>
            {/each}
        </div>
    </div>
    <div
        class="grow-0 flex flex-row justify-between items-center w-full gap-x-2 text-sm text-gray-200"
    >
        {#if gameSession.myPlayer !== undefined}
            <EmojiPicker onPick={onEmojiPick} onHidden={onEmojiHide} />
        {/if}
        <div class="grow-wrap w-full text-gray-200">
            <textarea
                bind:this={input}
                bind:value={text}
                maxlength="500"
                class="w-full rounded-lg {inputBgColor} p-2 text-sm
                text-gray-900 dark:placeholder-gray-400 dark:text-white border
                {inputBorderColor} focus:border-primary-500 dark:focus:ring-primary-500
                dark:focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                oninput={sizeInput}
                onkeydown={(event) => handleKeyDown(event)}
                rows="1"
                name="message"
                placeholder=""
                disabled={gameSession.myPlayer === undefined}
            ></textarea>
        </div>

        <Button
            onclick={() => sendMessage()}
            size="sm"
            class="px-2 w-[50px]"
            disabled={gameSession.myPlayer === undefined}
            ><svg
                class="w-6 h-6 text-gray-800 dark:text-white"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <g transform="translate(24, 0) rotate(90)">
                    <path
                        fill-rule="evenodd"
                        d="M12 2a1 1 0 0 1 .932.638l7 18a1 1 0 0 1-1.326 1.281L13 19.517V13a1 1 0 1 0-2 0v6.517l-5.606 2.402a1 1 0 0 1-1.326-1.281l7-18A1 1 0 0 1 12 2Z"
                        clip-rule="evenodd"
                    ></path>
                </g>
            </svg>
        </Button>
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
