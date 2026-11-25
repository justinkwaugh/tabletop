<script lang="ts">
    import { Modal } from 'flowbite-svelte'
    import type { Game, GameChatMessage } from '@tabletop/common'
    import { contentReport } from '$lib/stores/contentReport.svelte'
    import ReportContentForm from './ReportContentForm.svelte'
    import { m } from '$lib/paraglide/messages'

    let { game, messages }: { game: Game; messages: GameChatMessage[] } = $props()
</script>

<Modal
    bind:open={
        () => contentReport.current !== undefined,
        (isOpen) => {
            if (!isOpen) contentReport.close()
        }
    }
    title={contentReport.current?.message ? m.games_report_message_title() : m.games_report_title()}
    size="sm"
    autoclose={false}
    outsideclose
>
    {#key contentReport.current}
        {#if contentReport.current}
            <ReportContentForm opening={contentReport.current} {game} {messages} />
        {/if}
    {/key}
</Modal>
