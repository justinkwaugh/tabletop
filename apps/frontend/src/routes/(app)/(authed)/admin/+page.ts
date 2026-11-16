import { authorizeAdminRoute } from '$lib/utils/adminRoute.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    await authorizeAdminRoute(url)
}
