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
    import { bugReportRequest } from '$lib/utils/bugReport'
    import { imageFiles, screenshotFromImage, type Screenshot } from '$lib/utils/screenshot'

    let {
        open = $bindable(),
        session
    }: { open: boolean; session: GameSession<GameState, HydratedGameState> } = $props()

    const { api, manifestService } = getAppContext()

    let description = $state('')
    let screenshots = $state<Screenshot[]>([])
    let readingScreenshots = $state(0)
    let submitting = $state(false)
    let canSubmit = $derived(
        description.trim().length > 0 && readingScreenshots === 0 && !submitting
    )

    onDestroy(() => clearScreenshots())

    async function pasteScreenshots(event: ClipboardEvent) {
        const images = imageFiles(event.clipboardData?.files ?? [])
        const room = BUG_REPORT_SCREENSHOT_MAX_COUNT - screenshots.length - readingScreenshots
        if (images.length > room) {
            toast.info(`A report can include up to ${BUG_REPORT_SCREENSHOT_MAX_COUNT} screenshots.`)
        }
        const taken = images.slice(0, Math.max(0, room))
        readingScreenshots += taken.length
        for (const image of taken) {
            try {
                const screenshot = await screenshotFromImage(image)
                screenshots = [...screenshots, screenshot]
            } catch (error) {
                console.error('Could not read the pasted image', error)
                toast.error('Could not read that image.')
            } finally {
                readingScreenshots -= 1
            }
        }
    }

    function removeScreenshot(removed: Screenshot) {
        URL.revokeObjectURL(removed.previewUrl)
        screenshots = screenshots.filter((screenshot) => screenshot !== removed)
    }

    function clearScreenshots() {
        for (const screenshot of screenshots) {
            URL.revokeObjectURL(screenshot.previewUrl)
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
                bugReportRequest({
                    session,
                    description,
                    screenshots: screenshots.map((screenshot) => screenshot.base64),
                    manifestService
                })
            )
            description = ''
            clearScreenshots()
            open = false
            toast.success('Thanks! Your bug report was sent.')
        } catch (error) {
            console.error('Could not send the bug report', error)
            toast.error('Could not send your bug report. Please try again in a few minutes.')
        } finally {
            submitting = false
        }
    }
</script>

<Modal bind:open title="Report a bug" size="sm" outsideclose autoclose={false}>
    <form class="flex flex-col gap-3" onsubmit={submit}>
        <Label for="bug-report-description">What went wrong?</Label>
        <Textarea
            id="bug-report-description"
            class="w-full"
            bind:value={description}
            maxlength={BUG_REPORT_DESCRIPTION_MAX_LENGTH}
            rows={6}
            placeholder="What did you do, what happened, and what did you expect to happen?"
            onpaste={pasteScreenshots}
        />
        {#if screenshots.length > 0 || readingScreenshots > 0}
            <div class="flex flex-wrap gap-3 pt-1">
                {#each screenshots as screenshot, index (screenshot.previewUrl)}
                    <div class="relative">
                        <img
                            src={screenshot.previewUrl}
                            alt="Screenshot {index + 1}"
                            class="h-16 w-auto rounded border border-gray-300 dark:border-gray-600"
                        />
                        <button
                            type="button"
                            class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs leading-none text-white hover:bg-gray-900"
                            aria-label="Remove screenshot {index + 1}"
                            onclick={() => removeScreenshot(screenshot)}>×</button
                        >
                    </div>
                {/each}
                {#if readingScreenshots > 0}
                    <div
                        class="flex h-16 w-24 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600"
                    >
                        Adding…
                    </div>
                {/if}
            </div>
        {/if}
        <Helper class="flex justify-between gap-4">
            <span>
                The game, the action you're viewing, and your browser details are included
                automatically.
            </span>
            <span class="shrink-0">{description.length}/{BUG_REPORT_DESCRIPTION_MAX_LENGTH}</span>
        </Helper>
        <div class="flex justify-end gap-2 pt-2">
            <Button color="light" type="button" onclick={() => (open = false)}>Cancel</Button>
            <Button type="submit" color="blue" disabled={!canSubmit}
                >{submitting ? 'Sending…' : 'Submit'}</Button
            >
        </div>
    </form>
</Modal>
