import { createRouter, createWebHashHistory } from 'vue-router';
import { isLoggedIn, isSuper } from './auth';

const router = createRouter({
  // hash 模式，静态托管部署到任意子路径都不会 404
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue') },
    {
      path: '/',
      component: () => import('./views/Layout.vue'),
      redirect: '/review/cats',
      children: [
        { path: 'dashboard', component: () => import('./views/Dashboard.vue') },
        { path: 'review/cats', component: () => import('./views/ReviewCats.vue') },
        { path: 'review/edits', component: () => import('./views/ReviewEdits.vue') },
        { path: 'review/records', component: () => import('./views/ReviewRecords.vue') },
        { path: 'cats', component: () => import('./views/AllCats.vue') },
        { path: 'records', component: () => import('./views/Records.vue') },
        { path: 'users', component: () => import('./views/Users.vue') },
        { path: 'supporters', component: () => import('./views/Supporters.vue') },
        { path: 'admins', component: () => import('./views/Admins.vue'), meta: { superOnly: true } },
        { path: 'feedbacks', component: () => import('./views/Feedbacks.vue') },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.path !== '/login' && !isLoggedIn()) {
    return '/login';
  }
  if (to.path === '/login' && isLoggedIn()) {
    return '/';
  }
  // 子管理员管理页仅最高管理员可访问
  if (to.meta.superOnly && !isSuper()) {
    return '/review/cats';
  }
  return true;
});

export default router;
