<script lang="ts">
    import { P, Heading, A, Card, List, Li } from 'flowbite-svelte'
    import { CheckOutline } from 'flowbite-svelte-icons'
</script>

<div class="p-8 flex flex-col justify-center items-center space-y-8 w-full">
    <div class="max-w-[700px]">
        <Heading class="text-gray-900 dark:text-gray-100 text-center">Hello there!</Heading>
        <P class="mt-4 text-gray-600 dark:text-gray-300">
            <span class="text-[#427ac7] font-bold text-2xl">Board</span><span
                class="text-2xl font-light">Together</span
            > is yet another website for playing board games online with friends. It is also an open
            source project, intend to be free for anyone to use in any way they see fit. Hopefully you
            have been enjoying your games here without too many hiccups. If you have any feedback, we
            would love to hear it!
        </P>
    </div>
    <Card>
        <Heading class="text-center" tag="h2">Talk to us...</Heading>
        <P class="mt-4 text-gray-600 dark:text-gray-300">
            If you have any complements, complaints, or suggestions, or have found something that
            just doesn't work right, feel free to come chat about it in our <A
                href="https://discord.gg/5ggK5VGGvA">Discord</A
            > server
        </P>
    </Card>
    <div>
        <Heading class="text-center" tag="h2">Care to lend a hand?</Heading>
        <P class="mt-4 text-gray-600 dark:text-gray-300">
            If you are interested in contributing to the project, please check out the <A
                href="https://github.com/justinkwaugh/tabletop">Tabletop</A
            > project on GitHub.
        </P>
        <div class="flex flex-col justify-center items-center mt-4">
            <Card class="mt-4 text-gray-600 dark:text-gray-300 fit-content"
                ><Heading tag="h6" class="mb-2">There are lots of ways to contribute:</Heading>
                <List>
                    <Li icon class="gap-3"
                        ><CheckOutline class="w-5 h-5 text-green-500 dark:text-green-400" />Graphic
                        design...</Li
                    >
                    <Li icon class="gap-3"
                        ><CheckOutline class="w-5 h-5 text-green-500 dark:text-green-400" />Bug
                        fixes and new features...</Li
                    >
                    <Li icon class="gap-3"
                        ><CheckOutline
                            class="w-5 h-5 text-green-500 dark:text-green-400"
                        />Implementing new games...</Li
                    >
                    <Li icon class="gap-3"
                        ><CheckOutline class="w-5 h-5 text-green-500 dark:text-green-400" />Sharing
                        all your awesome ideas...</Li
                    >
                </List>
            </Card>
        </div>
    </div>
</div>
