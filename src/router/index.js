import { createRouter, createWebHistory } from "vue-router";
import UserListView from "../views/UserListView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: UserListView
    }
  ],
});

export default router;
