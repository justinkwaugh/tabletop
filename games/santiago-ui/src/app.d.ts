// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { SantiagoGameSession } from '$lib/stores/SantiagoGameSession.svelte.js'

declare global {
    interface Window {
        santiagoSession: SantiagoGameSession
    }

    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface Platform {}
    }
}

export {}
