import { createRouter, createWebHistory } from "vue-router";
import UserListView from "../views/UserListView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      redirect: "/users"
    },
    {
      path: "/users",
      name: "users",
      component: UserListView
    }
  ],
});

export default router;
