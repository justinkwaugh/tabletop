import { PUBLIC_TIME_DIFFERENCE_STARTS_AT } from '$env/static/public'
import { parseTimeDifferenceStartDate } from '@tabletop/common'

export const timeDifferenceStartsAt = parseTimeDifferenceStartDate(PUBLIC_TIME_DIFFERENCE_STARTS_AT)
