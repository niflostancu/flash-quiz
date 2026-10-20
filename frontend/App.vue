<script setup lang="ts">
import AdminPage from "./pages/AdminPage.vue";
import DisplayPage from "./pages/DisplayPage.vue";
import NotFoundPage from "./pages/NotFoundPage.vue";
import StudentPage from "./pages/StudentPage.vue";

// right-trim slashes in path 
const path = location.pathname.replace(/\/+$/, "") || "/";
</script>

<template>
  <!-- No router needed, simply load pages conditionally.
    Each page owns its layout (header/footer). -->
  <StudentPage v-if="path === '/'" />
  <AdminPage v-else-if="path === '/admin'" />
  <DisplayPage v-else-if="path === '/display'" />
  <NotFoundPage v-else :path="path" />
</template>
