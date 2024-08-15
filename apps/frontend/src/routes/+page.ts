import { redirect } from '@sveltejs/kit'

// Provide a redirect for the root path
export async function load() {
    redirect(302, '/dashboard')
}
