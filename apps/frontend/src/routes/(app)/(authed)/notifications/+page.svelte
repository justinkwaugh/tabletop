<script lang="ts">
    import { Card, Hr } from 'flowbite-svelte'
    import { ExternalAuthService } from '@tabletop/common'
    import DiscordSignIn, {
        isEnabled as isDiscordSigninEnabled
    } from '$lib/components/DiscordSignIn.svelte'
    import { getAppContext } from '@tabletop/frontend-components'
    import ReminderHoursEditor from '$lib/components/ReminderHoursEditor.svelte'

    let { authorizationService } = getAppContext()

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let linkedAccountIdsByType: Map<string, string> = $derived.by(() => {
        return new Map(
            user?.externalIds?.map((id) => {
                const split = id.split(':', 2)
                const type = split[0]
                return [type, id]
            }) ?? []
        )
    })
</script>

<div class="flex min-h-[calc(100dvh-70px)] flex-col items-center justify-center gap-6 px-2 py-6">
    <Card size="md" class="bg-gray-300 p-4 sm:p-6">
        <div class="flex flex-col gap-3">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Web Notifications</h3>
            <p class="text-sm text-gray-700 dark:text-gray-300">
                You can receive notifications from Board Together directly in your web browser. Just
                accept the permission prompt your browser shows you.
            </p>
        </div>

        {#if isDiscordSigninEnabled}
            <Hr class="my-6" />
            <div class="flex flex-col gap-3">
                <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                    Discord Notifications
                </h3>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                    Board Together has a Discord bot that can send you direct notification messages.
                    No server webhook configuration is needed, and the messages will come to you
                    regardless of what server you are in.
                </p>
                {#if linkedAccountIdsByType.get(ExternalAuthService.Discord)}
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Add the bot to your Discord account and it will start sending you
                        notifications right away.
                    </p>
                    <div class="flex justify-center py-1">
                        <DiscordSignIn mode="bot" />
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300">
                        Bot commands:
                        <ul class="mt-2 rounded-sm bg-gray-200 p-3 dark:bg-gray-700">
                            <li>
                                <span class="tracking-wider">/notify</span> - Enable notifications
                            </li>
                            <li>
                                <span class="tracking-wider">/stop</span> - Disable notifications
                            </li>
                        </ul>
                    </div>
                {:else}
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        First link your Discord account.
                    </p>
                    <div class="flex justify-center py-1">
                        <DiscordSignIn mode="link" />
                    </div>
                {/if}
            </div>
        {/if}
    </Card>
    <Card size="md" class="bg-gray-300 p-4 sm:p-6">
        <div class="flex flex-col gap-3">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Reminder Hours</h3>
            <ReminderHoursEditor />
        </div>
    </Card>
</div>
