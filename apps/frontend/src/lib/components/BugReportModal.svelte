<script lang="ts">
    import { Button, Helper, Label, Modal, Textarea } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import {
        BUG_REPORT_DESCRIPTION_MAX_LENGTH,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { bugReportRequest } from '$lib/utils/bugReport'

    let {
        open = $bindable(),
        session
    }: { open: boolean; session: GameSession<GameState, HydratedGameState> } = $props()

    const { api, manifestService } = getAppContext()

    let description = $state('')
    let submitting = $state(false)
    let canSubmit = $derived(description.trim().length > 0 && !submitting)

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        if (!canSubmit) {
            return
        }

        submitting = true
        try {
            await api.reportBug(bugReportRequest({ session, description, manifestService }))
            description = ''
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
        />
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
