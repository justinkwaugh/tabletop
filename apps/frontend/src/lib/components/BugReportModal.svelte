<script lang="ts">
    import { Button, Helper, Label, Modal, Textarea } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { onDestroy } from 'svelte'
    import {
        BUG_REPORT_DESCRIPTION_MAX_LENGTH,
        BUG_REPORT_SCREENSHOT_MAX_COUNT,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { bugReportFailureMessage, bugReportRequest } from '$lib/utils/bugReport'
    import {
        pastedImages,
        releaseScreenshot,
        screenshotFromImage,
        type Screenshot
    } from '$lib/utils/screenshot'
    import { m } from '$lib/paraglide/messages'

    let {
        open = $bindable(),
        session
    }: { open: boolean; session: GameSession<GameState, HydratedGameState> } = $props()

    const { api, gameService, manifestService } = getAppContext()

    let description = $state('')
    let screenshots = $state<Screenshot[]>([])
    let pendingScreenshots = $state(0)
    let submitting = $state(false)
    let canSubmit = $derived(
        description.trim().length > 0 && pendingScreenshots === 0 && !submitting
    )

    let destroyed = false

    onDestroy(() => {
        destroyed = true
        clearScreenshots()
    })

    async function pasteScreenshots(event: ClipboardEvent) {
        const clipboard = event.clipboardData
        const images = clipboard ? pastedImages(clipboard.types, clipboard.files) : []
        const openSlots = BUG_REPORT_SCREENSHOT_MAX_COUNT - screenshots.length - pendingScreenshots
        if (images.length > openSlots) {
            toast.info(
                m.games_bug_report_screenshot_limit({ count: BUG_REPORT_SCREENSHOT_MAX_COUNT })
            )
        }
        const accepted = images.slice(0, openSlots)
        pendingScreenshots += accepted.length
        for (const image of accepted) {
            try {
                const screenshot = await screenshotFromImage(image)
                if (destroyed) {
                    releaseScreenshot(screenshot)
                    continue
                }
                screenshots = [...screenshots, screenshot]
            } catch (error) {
                console.error('Could not read the pasted image', error)
                toast.error(m.games_bug_report_image_unreadable())
            } finally {
                pendingScreenshots -= 1
            }
        }
    }

    function removeScreenshot(removed: Screenshot) {
        releaseScreenshot(removed)
        screenshots = screenshots.filter((screenshot) => screenshot !== removed)
    }

    function clearScreenshots() {
        for (const screenshot of screenshots) {
            releaseScreenshot(screenshot)
        }
        screenshots = []
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (!canSubmit) {
            return
        }

        submitting = true
        try {
            await api.reportBug(
                await bugReportRequest({
                    session,
                    description,
                    screenshots: screenshots.map((screenshot) => screenshot.base64),
                    localGameStore: gameService.localGameStore,
                    manifestService
                })
            )
            description = ''
            clearScreenshots()
            open = false
            toast.success(m.games_bug_report_sent())
        } catch (error) {
            console.error('Could not send the bug report', error)
            toast.error(bugReportFailureMessage(error))
        } finally {
            submitting = false
        }
    }
</script>

<Modal bind:open title={m.nav_report_bug()} size="sm" outsideclose autoclose={false}>
    <form class="flex flex-col gap-3" onsubmit={submit}>
        <Label for="bug-report-description">{m.games_bug_report_what_went_wrong()}</Label>
        <Textarea
            id="bug-report-description"
            class="w-full"
            bind:value={description}
            maxlength={BUG_REPORT_DESCRIPTION_MAX_LENGTH}
            rows={6}
            placeholder={m.games_bug_report_placeholder()}
            onpaste={pasteScreenshots}
        />
        {#if screenshots.length > 0 || pendingScreenshots > 0}
            <div class="flex flex-wrap gap-3 pt-1">
                {#each screenshots as screenshot, index (screenshot.previewUrl)}
                    <div class="relative">
                        <img
                            src={screenshot.previewUrl}
                            alt={m.games_bug_report_screenshot_alt({ number: index + 1 })}
                            class="h-16 w-auto rounded border border-gray-300 dark:border-gray-600"
                        />
                        <button
                            type="button"
                            class="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-sm leading-none text-white hover:bg-gray-900"
                            aria-label={m.games_bug_report_remove_screenshot({ number: index + 1 })}
                            onclick={() => removeScreenshot(screenshot)}>×</button
                        >
                    </div>
                {/each}
                {#if pendingScreenshots > 0}
                    <div
                        class="flex h-16 w-24 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600"
                    >
                        {m.games_bug_report_adding()}
                    </div>
                {/if}
            </div>
        {/if}
        <Helper class="flex justify-between gap-4">
            <span>{m.games_bug_report_privacy()}</span>
            <span class="shrink-0">{description.length}/{BUG_REPORT_DESCRIPTION_MAX_LENGTH}</span>
        </Helper>
        <div class="flex justify-end gap-2 pt-2">
            <Button color="light" type="button" onclick={() => (open = false)}>{m.cancel()}</Button>
            <Button type="submit" color="blue" disabled={!canSubmit}
                >{submitting ? m.games_bug_report_sending() : m.submit()}</Button
            >
        </div>
    </form>
</Modal>
