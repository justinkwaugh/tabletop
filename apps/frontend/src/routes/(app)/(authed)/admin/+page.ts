import { redirect } from '@sveltejs/kit'
import { adminTabPath } from '$lib/utils/adminPaths.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = () => {
    redirect(307, adminTabPath('users'))
}
