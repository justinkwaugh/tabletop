<script lang="ts">
    import { Button, Input } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import {
        REDACTED_CHAT_MESSAGE_TEXT,
        conversationMessageAuthorName,
        type GameChatMessage
    } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import type { PageProps } from './$types'

    let { data }: PageProps = $props()
    const { api } = getAppContext()

    let game = $derived(data.game)
    let messages = $derived(data.messages)
    let name = $derived(data.game?.name ?? '')
    let working = $state(false)

    async function rename(event: SubmitEvent) {
        event.preventDefault()
        if (!game || working || name.trim() === game.name) return
        working = true
        try {
            game = await api.renameGameAsAdministrator(game.id, name.trim())
            name = game.name
            toast.success('Game renamed.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The game could not be renamed.')
        } finally {
            working = false
        }
    }

    async function redact(message: GameChatMessage) {
        if (!game || working) return
        if (
            !window.confirm(
                `Remove this message by ${conversationMessageAuthorName(game, message)}?`
            )
        ) {
            return
        }
        working = true
        try {
            await api.redactGameChatMessage(game.id, message.id)
            messages = messages.map((candidate) =>
                candidate.id === message.id
                    ? { ...candidate, text: REDACTED_CHAT_MESSAGE_TEXT, redacted: true }
                    : candidate
            )
            toast.success('Message removed.')
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'The message could not be removed.'
            )
        } finally {
            working = false
        }
    }
</script>

<svelte:head><title>Moderate · Tabletop</title></svelte:head>
<main class="collection-page pb-10 text-gray-900 dark:text-gray-100">
    <header class="collection-header">
        <h1 class="collection-heading">Moderate game</h1>
    </header>
    {#if game}
        <section class="flex flex-col gap-3 py-4">
            <a class="text-sm underline" href={`/game/${game.id}`}>Open the game</a>
            <form class="flex max-w-xl flex-row gap-2" onsubmit={rename}>
                <Input bind:value={name} aria-label="Game name" />
                <Button type="submit" disabled={working || name.trim() === game.name}>Rename</Button
                >
            </form>
        </section>
        <section class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">Chat</h2>
            {#if messages.length === 0}
                <p class="text-sm text-gray-500 dark:text-gray-400">No messages.</p>
            {/if}
            {#each messages as message (message.id)}
                <div
                    class="flex flex-row items-start justify-between gap-3 rounded-md px-3 py-2 text-sm {message.id ===
                    data.messageId
                        ? 'bg-amber-100 dark:bg-amber-900/40'
                        : ''}"
                >
                    <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            {conversationMessageAuthorName(game, message)} · {message.timestamp.toLocaleString()}
                        </p>
                        <p
                            class="whitespace-pre-wrap {message.redacted
                                ? 'italic text-gray-500'
                                : ''}"
                        >
                            {message.text}
                        </p>
                    </div>
                    {#if !message.redacted}
                        <Button
                            size="xs"
                            color="red"
                            disabled={working}
                            onclick={() => redact(message)}>Remove</Button
                        >
                    {/if}
                </div>
            {/each}
        </section>
    {/if}
</main>
