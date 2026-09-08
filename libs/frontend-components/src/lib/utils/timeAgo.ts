import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'

export function createTimeAgo(): TimeAgo {
    TimeAgo.addLocale(en)
    return new TimeAgo('en-US')
}
