<script lang="ts">
    import { Alert, Button, Radio, Select, Textarea } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import {
        CONTENT_REPORT_DETAILS_MAX_LENGTH,
        CONTENT_REPORT_REASON_LABELS,
        ContentReportReason,
        ContentReportTargetKind,
        conversationMessageAuthorName,
        type ContentReportTarget,
        type Game,
        type GameChatMessage
    } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { contentReport, type ContentReportOpening } from '$lib/stores/contentReport.svelte'

    let {
        opening,
        game,
        messages
    }: { opening: ContentReportOpening; game: Game; messages: GameChatMessage[] } = $props()

    const { api, authorizationService } = getAppContext()
    const reasons = Object.values(ContentReportReason)

    let fromMessage = $derived(opening.message)
    let kind: ContentReportTargetKind = $state(ContentReportTargetKind.GameName)
    let playerId = $state('')
    let messageId = $state('')
    let reason: ContentReportReason | undefined = $state(undefined)
    let details = $state('')
    let sending = $state(false)
    let failure: string | undefined = $state(undefined)

    let sessionUserId = $derived(authorizationService.getSessionUser()?.id)
    let otherPlayers = $derived(
        game.players.filter((player) => player.userId && player.userId !== sessionUserId)
    )
    let myPlayerIds = $derived(
        new Set(game.players.filter((p) => p.userId === sessionUserId).map((p) => p.id))
    )
    let reportableMessages = $derived(
        messages
            .filter((m) => !m.redacted && !m.admin && !myPlayerIds.has(m.playerId ?? ''))
            .toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    )

    let reportedName = $derived.by(() => {
        if (fromMessage) return conversationMessageAuthorName(game, fromMessage)
        if (kind === ContentReportTargetKind.GameName) return "The game's owner"
        if (kind === ContentReportTargetKind.Username) {
            return game.players.find((player) => player.id === playerId)?.name ?? 'The player'
        }
        const message = reportableMessages.find((m) => m.id === messageId)
        return message ? conversationMessageAuthorName(game, message) : 'The player'
    })

    let target: ContentReportTarget | undefined = $derived.by(() => {
        if (fromMessage) {
            return { kind: ContentReportTargetKind.ConversationMessage, messageId: fromMessage.id }
        }
        if (kind === ContentReportTargetKind.GameName) return { kind }
        if (kind === ContentReportTargetKind.Username) {
            return playerId ? { kind, playerId } : undefined
        }
        return messageId ? { kind, messageId } : undefined
    })

    function excerpt(text: string): string {
        return text.length > 60 ? `${text.slice(0, 60)}…` : text
    }

    async function send(event: SubmitEvent) {
        event.preventDefault()
        if (!target || !reason || sending) return
        sending = true
        failure = undefined
        try {
            const trimmed = details.trim()
            await api.reportContent({
                gameId: game.id,
                target,
                reason,
                ...(trimmed ? { details: trimmed } : {})
            })
            contentReport.close()
            toast.success('Thanks. Your report was sent.')
        } catch (error) {
            failure =
                error instanceof Error && error.message
                    ? error.message
                    : 'Your report could not be sent. Try again.'
        } finally {
            sending = false
        }
    }
</script>

<form class="flex flex-col gap-4 text-sm" onsubmit={send}>
    {#if fromMessage}
        <div
            class="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        >
            <p class="text-xs text-gray-500 dark:text-gray-400">
                {conversationMessageAuthorName(game, fromMessage)}
            </p>
            <p class="whitespace-pre-wrap text-gray-900 dark:text-gray-200">{fromMessage.text}</p>
        </div>
    {:else}
        <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                What are you reporting?
            </legend>
            <Radio name="report-kind" bind:group={kind} value={ContentReportTargetKind.GameName}
                >The game name “{game.name}”</Radio
            >
            {#if otherPlayers.length > 0}
                <Radio name="report-kind" bind:group={kind} value={ContentReportTargetKind.Username}
                    >A player's username</Radio
                >
                {#if kind === ContentReportTargetKind.Username}
                    <Select bind:value={playerId} class="ml-6 w-auto" aria-label="Player">
                        <option value="" disabled>Choose a player</option>
                        {#each otherPlayers as player (player.id)}
                            <option value={player.id}>{player.name}</option>
                        {/each}
                    </Select>
                {/if}
            {/if}
            {#if reportableMessages.length > 0}
                <Radio
                    name="report-kind"
                    bind:group={kind}
                    value={ContentReportTargetKind.ConversationMessage}>A chat message</Radio
                >
                {#if kind === ContentReportTargetKind.ConversationMessage}
                    <Select bind:value={messageId} class="ml-6 w-auto" aria-label="Message">
                        <option value="" disabled>Choose a message</option>
                        {#each reportableMessages as message (message.id)}
                            <option value={message.id}
                                >{conversationMessageAuthorName(game, message)}: {excerpt(
                                    message.text
                                )}</option
                            >
                        {/each}
                    </Select>
                {/if}
            {/if}
        </fieldset>
    {/if}

    <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            What's wrong with it?
        </legend>
        {#each reasons as option (option)}
            <Radio name="report-reason" bind:group={reason} value={option}
                >{CONTENT_REPORT_REASON_LABELS[option]}</Radio
            >
        {/each}
    </fieldset>

    <label class="flex flex-col gap-2">
        <span class="font-semibold text-gray-900 dark:text-gray-100"
            >Anything else we should know? <span
                class="font-normal text-gray-500 dark:text-gray-400">(optional)</span
            ></span
        >
        <Textarea
            bind:value={details}
            rows={3}
            maxlength={CONTENT_REPORT_DETAILS_MAX_LENGTH}
            class="w-full"
        />
    </label>

    <p class="text-xs text-gray-500 dark:text-gray-400">
        {reportedName} won't be told who reported this. We look at every report within a few days.
    </p>

    {#if failure}
        <Alert color="red">{failure}</Alert>
    {/if}

    <div class="flex justify-end gap-2">
        <Button color="alternative" type="button" onclick={() => contentReport.close()}
            >Cancel</Button
        >
        <Button type="submit" disabled={!target || !reason || sending}>Send report</Button>
    </div>
</form>
