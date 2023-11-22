<template>
    <UPageBody>
        <pre>{{ auth.user }}</pre>
    </UPageBody>
</template>

<script lang="ts" setup>
const { $auth } = useNuxtApp()
const auth = useAuth()
console.log(auth)
console.log($auth)
</script>