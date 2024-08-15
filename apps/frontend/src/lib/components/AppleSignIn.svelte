<script lang="ts">
    let appleLibraryLoaded = false
    let mounted = false

    function onAppleLibraryLoaded() {
        appleLibraryLoaded = true
        if (mounted) {
            setupAppleSignin()
        }
    }

    function setupAppleSignin() {}

    $effect(() => {
        mounted = true
        if (appleLibraryLoaded) {
            setupAppleSignin()
        }
    })
</script>

<div>
    <script
        src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
        onload={onAppleLibraryLoaded}
        async
        defer
    ></script>
    <div id="appleid-signin" data-color="white"></div>
</div>
