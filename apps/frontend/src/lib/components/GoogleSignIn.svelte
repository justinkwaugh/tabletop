<script lang="ts">
    import { TabletopApi } from '@tabletop/frontend-components'
    import { getContext, onMount } from 'svelte'
    import { isLibraryLoaded, markLibraryLoaded } from '$lib/stores/libraryLoaded.svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public'
    import { P } from 'flowbite-svelte'

    let { mode = 'login' }: { mode: 'link' | 'login' } = $props()

    let { authorizationService, api } = getContext('appContext') as AppContext

    const LIBRARY_ID = 'google-sign-in'

    let mounted = $state(false)
    let initialized = $state(false)
    async function setupGoogleSignin() {
        if (initialized) {
            return
        }
        initialized = true
        const handleCredentialResponse = async (response: any) => {
            if (response.credential) {
                if (mode === 'login') {
                    const user = await api.loginGoogle(response.credential)
                    await authorizationService.onLogin(user)
                } else if (mode === 'link') {
                    const user = await api.linkGoogle(response.credential)
                    authorizationService.setSessionUser(user)
                }
            }
        }

        google.accounts.id.initialize({
            client_id: PUBLIC_GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        })

        const buttonElement = document.getElementById('google-sign-in-button')
        if (buttonElement) {
            google.accounts.id.renderButton(
                buttonElement,
                {
                    type: 'standard',
                    theme: 'outline',
                    size: mode === 'login' ? 'large' : 'medium',
                    text: mode === 'login' ? 'signin_with' : 'signin',
                    shape: 'pill',
                    logo_alignment: 'left',
                    width: mode === 'login' ? 334 : 100
                } // customization attributes
            )
        } else {
            console.error('Google Sign-In button element not found')
        }
    }

    function onGoogleLibraryLoaded() {
        markLibraryLoaded(LIBRARY_ID)
        if (mounted) {
            setupGoogleSignin()
        }
    }

    onMount(() => {
        mounted = true
        if (isLibraryLoaded(LIBRARY_ID)) {
            setupGoogleSignin()
        }
    })
</script>

<div>
    <div id="google-sign-in-button"><div><div></div></div></div>
    <script
        src="https://accounts.google.com/gsi/client"
        onload={onGoogleLibraryLoaded}
        async
        defer
    ></script>
</div>

<style>
    #google-sign-in-button {
        height: 44px;
        width: auto;
    }

    #google-sign-in-button > div > div:first-child {
        display: none;
    }
</style>
