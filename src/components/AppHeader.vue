<script setup>
</script>

<template>
  <header class="app-header">
    <div class="container">
      <div class="header-content">
        <div></div>
        <div class="logo">
          <img src="/alixpartners-logo-black.webp" alt="AlixPartners Logo" class="alix-logo" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.link {
  margin: 0px;
}

.app-header {
  background-color: white;
  padding: 16px 0;
  border-bottom: 1px solid #ddd;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
}

.alix-logo {
  height: 32px;
  object-fit: contain;
}

.nav-menu {
  display: flex;
  gap: 48px;
}

.nav-menu a {
  color: #111;
  font-size: 0.95rem;
  font-weight: 400;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-menu a:hover {
  color: #1D8837;
}
</style>
