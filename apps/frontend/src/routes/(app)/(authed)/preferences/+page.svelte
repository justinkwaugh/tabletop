<script lang="ts">
    import { Card, Label, Button, Alert, Helper, Toggle } from 'flowbite-svelte'
    import { Color, UserPreferences } from '@tabletop/common'
    import { flip } from 'svelte/animate'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { ColorblindColorizer, DefaultColorizer } from '@tabletop/frontend-components'

    let { authorizationService, api } = getContext('appContext') as AppContext

    const colorblindColorizer = new ColorblindColorizer()
    const defaultColorizer = new DefaultColorizer()
    let errors: Record<string, string[]> = $state({})
    let errorMessage: string | undefined = $state(undefined)
    let success = $state(false)

    let sessionUser = authorizationService.getSessionUser()

    let preferences: UserPreferences = $state(
        sessionUser?.preferences ?? {
            preventWebNotificationPrompt: false,
            preferredColors: Object.values(Color),
            preferredColorsEnabled: false
        }
    )

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let bgColorForColor = (color?: Color) => {
        if (preferences.colorBlindPalette) {
            return colorblindColorizer.getBgColor(color)
        }

        return defaultColorizer.getBgColor(color)
    }

    async function submit(event: SubmitEvent) {
        if (!user) return
        event.preventDefault()
        clearErrors()

        try {
            const newUser = await api.updateUserPreferences(user.id, preferences)
            success = true
            authorizationService.setSessionUser(newUser)
        } catch (e) {
            console.log(e)
            errorMessage = 'An unexpected error occurred, please try again'
        }
    }

    function clearErrors() {
        errorMessage = undefined
        errors = {}
    }

    let draggedColor: Color | undefined = $state(undefined)
    let draggedIndex: number | undefined = $state(undefined)

    function dragStart(event: DragEvent, source: string, index: number, color?: Color) {
        draggedColor = color
        draggedIndex = index
    }

    function dragEnter(event: DragEvent, from: string, index: number) {
        if (!preferences.preferredColors || draggedIndex === undefined || !draggedColor) return
        if (preferences.preferredColors[index] === draggedColor) {
            return
        }

        preferences.preferredColors.splice(draggedIndex, 1)
        preferences.preferredColors.splice(index, 0, draggedColor)

        draggedIndex = index
    }

    function allowDrop(event: DragEvent) {
        event.preventDefault()
    }

    function drop(event: DragEvent) {
        event.preventDefault()
        draggedIndex = undefined
        draggedColor = undefined
    }
</script>

<div>
    <script
        src="https://drag-drop-touch-js.github.io/dragdroptouch/dist/drag-drop-touch.esm.min.js?autoload"
        type="module"
    ></script>
</div>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card class="bg-gray-300 p-4 sm:p-6">
        <form class="flex flex-col space-y-6" action="/" onsubmit={submit}>
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                Set your preferences...
            </h3>
            {#if errorMessage}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Update Failed</span><br />
                    {errorMessage}
                </Alert>
            {/if}
            {#if success}
                <Alert class="dark:bg-green-200 dark:text-green-700 mb-4">
                    <span class="font-bold text-lg">Preferences Updated</span><br />
                </Alert>
            {/if}

            <Toggle bind:checked={preferences.preventWebNotificationPrompt}
                >Prevent Web Notifications Prompt</Toggle
            >
            <Toggle bind:checked={preferences.colorBlindPalette}>Colorblind Friendly Palette</Toggle
            >
            <div>
                <Toggle bind:checked={preferences.preferredColorsEnabled}
                    >Preferred Player Colors</Toggle
                >

                {#if preferences.preferredColorsEnabled}
                    <div class="mt-4 flex flex-col rounded-lg border-gray-600 border p-2">
                        <div class="flex flex-row justify-between items-center">
                            {#each preferences.preferredColors as color, i (color)}
                                <div
                                    role="button"
                                    tabindex="0"
                                    draggable={color !== undefined}
                                    ondragover={(e) => allowDrop(e)}
                                    ondrop={(e) => drop(e)}
                                    ondragstart={(e) => dragStart(e, 'colors', i, color)}
                                    ondragenter={(e) => dragEnter(e, 'colors', i)}
                                    animate:flip={{ duration: 100 }}
                                    class="{color === draggedColor
                                        ? ''
                                        : ''} rounded-lg h-[40px] w-[26px] {bgColorForColor(
                                        color
                                    )} border-gray-800 border-2"
                                ></div>
                            {/each}
                        </div>
                        <div class="flex flex-row justify-center items-center">
                            <Helper class="mt-2" color="gray"
                                ><span class="font-medium">drag to reorder</span></Helper
                            >
                        </div>
                    </div>
                {/if}
            </div>
            <div class="flex justify-end"><Button type="submit" class="">Save</Button></div>
        </form>
    </Card>
</div>
