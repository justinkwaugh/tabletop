<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { Toggle } from 'flowbite-svelte'
    import { wantsGameAndCompetitionEmails } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { userPreferencesEditor: editor } = getAppContext()
</script>

<Toggle
    checked={wantsGameAndCompetitionEmails(editor.values)}
    onchange={(event) => editor.update({ gameAndCompetitionEmails: event.currentTarget.checked })}
    >{m.email_notifications_toggle()}</Toggle
>
<p class="text-sm text-gray-700 dark:text-gray-300">
    {m.email_notifications_detail()}
</p>
<p class="text-sm font-medium text-gray-900 dark:text-white">
    {m.email_notifications_not_turns()}
</p>
