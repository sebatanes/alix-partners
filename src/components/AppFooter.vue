<template>
  <footer class="app-footer">
    <div class="container">
      <div class="footer-content">
        <img
          src="/alixpartners-logo-white.webp"
          alt="AlixPartners Logo White"
          class="footer-logo"
        />
        <span>Developed by Sebastian Atanes</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
</script>

<style scoped>
.app-footer {
  background-color: #000; 
  color: #fff;
  padding: 24px 0;
  text-align: center;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-logo {
  height: 20px;
  width: auto;
  object-fit: contain;
  display: block;
}

.footer-content span {
  font-size: 0.85rem;
  opacity: 0.8;
}
</style>
