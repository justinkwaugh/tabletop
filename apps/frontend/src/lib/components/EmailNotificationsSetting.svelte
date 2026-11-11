<script lang="ts">
    import { Toggle } from 'flowbite-svelte'
    import { wantsGameAndCompetitionEmails } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { userPreferencesEditor: editor } = getAppContext()
</script>

<Toggle
    checked={wantsGameAndCompetitionEmails(editor.values)}
    onchange={(event) => editor.update({ gameAndCompetitionEmails: event.currentTarget.checked })}
    >Email me about games and competitions</Toggle
>
<p class="text-sm text-gray-700 dark:text-gray-300">
    Invitations, finished games, and league and tournament news, including sign-up reminders. Turn
    notifications are never sent by email, and account emails always are.
</p>
