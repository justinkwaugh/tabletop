<script lang="ts">
    import { Alert, Button, Radio, Select, Textarea } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import {
        CONTENT_REPORT_DETAILS_MAX_LENGTH,
        ContentReportReason,
        ContentReportTargetKind,
        type ContentReportTarget,
        type Game,
        type GameChatMessage
    } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { contentReport, type ContentReportOpening } from '$lib/stores/contentReport.svelte'
    import { m } from '$lib/paraglide/messages'
    import RichMessage from './RichMessage.svelte'

    let {
        opening,
        game,
        messages
    }: { opening: ContentReportOpening; game: Game; messages: GameChatMessage[] } = $props()

    const { api, authorizationService } = getAppContext()
    const reasons = Object.values(ContentReportReason)
    const REASON_LABELS: Record<ContentReportReason, () => string> = {
        [ContentReportReason.Bullying]: m.games_report_reason_bullying,
        [ContentReportReason.Hate]: m.games_report_reason_hate,
        [ContentReportReason.SexualContent]: m.games_report_reason_sexual_content,
        [ContentReportReason.SelfHarm]: m.games_report_reason_self_harm,
        [ContentReportReason.IntimateImage]: m.games_report_reason_intimate_image,
        [ContentReportReason.Illegal]: m.games_report_reason_illegal,
        [ContentReportReason.Spam]: m.games_report_reason_spam,
        [ContentReportReason.Other]: m.games_report_reason_other
    }

    function authorName(message: Pick<GameChatMessage, 'playerId' | 'admin'>): string {
        if (message.admin) return m.games_report_author_administrator()
        return (
            game.players.find((player) => player.id === message.playerId)?.name ??
            m.games_report_author_unknown()
        )
    }

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
            .filter(
                (message) =>
                    !message.redacted && !message.admin && !myPlayerIds.has(message.playerId ?? '')
            )
            .toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    )

    let anonymityNotice = $derived.by(() => {
        if (fromMessage) return playerAnonymityNotice(authorName(fromMessage))
        if (kind === ContentReportTargetKind.GameName) return m.games_report_owner_anonymous()
        if (kind === ContentReportTargetKind.Username) {
            return playerAnonymityNotice(
                game.players.find((player) => player.id === playerId)?.name
            )
        }
        const message = reportableMessages.find((candidate) => candidate.id === messageId)
        return playerAnonymityNotice(message && authorName(message))
    })

    function playerAnonymityNotice(name: string | undefined): string {
        return name === undefined
            ? m.games_report_player_anonymous()
            : m.games_report_named_anonymous({ name })
    }

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
            toast.success(m.games_report_sent())
        } catch (error) {
            failure =
                error instanceof Error && error.message ? error.message : m.games_report_failed()
        } finally {
            sending = false
        }
    }
</script>

{#snippet optionalNote(text: string)}<span class="font-normal text-gray-500 dark:text-gray-400"
        >{text}</span
    >{/snippet}

<form class="flex flex-col gap-4 text-sm" onsubmit={send}>
    {#if fromMessage}
        <div
            class="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        >
            <p class="text-xs text-gray-500 dark:text-gray-400">
                {authorName(fromMessage)}
            </p>
            <p class="whitespace-pre-wrap text-gray-900 dark:text-gray-200">{fromMessage.text}</p>
        </div>
    {:else}
        <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                {m.games_report_what()}
            </legend>
            <Radio name="report-kind" bind:group={kind} value={ContentReportTargetKind.GameName}
                >{m.games_report_game_name({ name: game.name })}</Radio
            >
            {#if otherPlayers.length > 0}
                <Radio name="report-kind" bind:group={kind} value={ContentReportTargetKind.Username}
                    >{m.games_report_username()}</Radio
                >
                {#if kind === ContentReportTargetKind.Username}
                    <Select
                        bind:value={playerId}
                        class="ml-6 w-auto"
                        aria-label={m.games_report_player_label()}
                    >
                        <option value="" disabled>{m.games_report_choose_player()}</option>
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
                    value={ContentReportTargetKind.ConversationMessage}
                    >{m.games_report_chat_message()}</Radio
                >
                {#if kind === ContentReportTargetKind.ConversationMessage}
                    <Select
                        bind:value={messageId}
                        class="ml-6 w-auto"
                        aria-label={m.games_report_message_label()}
                    >
                        <option value="" disabled>{m.games_report_choose_message()}</option>
                        {#each reportableMessages as message (message.id)}
                            <option value={message.id}
                                >{m.games_report_message_option({
                                    author: authorName(message),
                                    text: excerpt(message.text)
                                })}</option
                            >
                        {/each}
                    </Select>
                {/if}
            {/if}
        </fieldset>
    {/if}

    <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 font-semibold text-gray-900 dark:text-gray-100">
            {m.games_report_whats_wrong()}
        </legend>
        {#each reasons as option (option)}
            <Radio name="report-reason" bind:group={reason} value={option}
                >{REASON_LABELS[option]()}</Radio
            >
        {/each}
    </fieldset>

    <label class="flex flex-col gap-2">
        <span class="font-semibold text-gray-900 dark:text-gray-100"
            ><RichMessage
                parts={m.games_report_anything_else.parts()}
                markup={{ optional: optionalNote }}
            /></span
        >
        <Textarea
            bind:value={details}
            rows={3}
            maxlength={CONTENT_REPORT_DETAILS_MAX_LENGTH}
            class="w-full"
        />
    </label>

    <p class="text-xs text-gray-500 dark:text-gray-400">
        {anonymityNotice}
    </p>

    {#if failure}
        <Alert color="red">{failure}</Alert>
    {/if}

    <div class="flex justify-end gap-2">
        <Button color="alternative" type="button" onclick={() => contentReport.close()}
            >{m.cancel()}</Button
        >
        <Button type="submit" disabled={!target || !reason || sending}
            >{m.games_report_send()}</Button
        >
    </div>
</form>
