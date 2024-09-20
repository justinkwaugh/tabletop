<script lang="ts">
    import { GameChatMessage } from '@tabletop/common'
    import { Input, Button, Textarea } from 'flowbite-svelte'
    import { FaceGrinSolid } from 'flowbite-svelte-icons'

    let messages: GameChatMessage[] = $state([
        {
            id: 'abc123',
            text: 'Just a cool message 1',
            playerId: '123',
            timestamp: new Date()
        },
        {
            id: 'abc12345',
            text: 'This message is long enough that it will need to wrap, so lets see how that works out for this',
            playerId: '123',
            timestamp: new Date()
        }
    ])

    function sizeInput(event: InputEvent) {
        const target = event.target as HTMLTextAreaElement
        if (!target) {
            return
        }
        target.parentNode.dataset.replicatedValue = target.value
    }
</script>

{#snippet chatMessage(message: GameChatMessage)}
    <div class="flex flex-row justify-start items-center gap-x-2">
        <div
            class="shrink-0 grow-0 flex justify-center items-center rounded-full bg-blue-400 w-[32px] h-[32px] text-xl font-bold"
        >
            J
        </div>
        <div class="flex flex-col justify-center items-start">
            <p class="text-xs text-gray-600">12:00 PM</p>
            <p class="text-gray-200 leading-[1.1rem]">{message.text}</p>
        </div>
    </div>
{/snippet}
<div
    class="flex flex-col justify-end items-center w-full p-2 rounded-lg border-gray-700 border-2 gap-y-4 h-full text-sm"
>
    <div class="flex flex-col justify-end items-start text-white w-full gap-y-4">
        {#each messages as message (message.id)}
            {@render chatMessage(message)}
        {/each}
    </div>
    <div class="grow-0 flex flex-row justify-between items-center w-full gap-x-2 text-sm">
        <div class="grow-wrap w-full">
            <textarea
                class="w-full rounded-lg bg-gray-50 dark:bg-gray-700
                text-gray-900 dark:placeholder-gray-400 dark:text-white border
                dark:border-gray-600 focus:border-primary-500 dark:focus:ring-primary-500
                dark:focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                oninput={sizeInput}
                rows="1"
                name="message"
                placeholder=""
            ></textarea>
        </div>
        <Button size="sm" class="w-[60px]" type="submit">Send</Button>
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
        max-height: 100px;

        /* Place on top of each other */
        grid-area: 1 / 1 / 2 / 2;
    }
</style>
