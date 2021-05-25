/**
 * @Author: tangzhicheng
 * @Date: 2021-02-26 15:17:41
 * @LastEditors: tangzhicheng
 * @LastEditTime: 2021-05-11 10:00:35
 * @Description: file content
 */

module.exports = {
  title: '唐某人的博客',
  description: '这是唐某人的技术博客，用于记录平日里学习JS，Vue，Webpack，React的相关心得。',
  base: process.env.NODE_ENV === 'development' ? '/' : '/tangmouren/',
  themeConfig: {
    // repo: 'ustbhuangyi/vue-analysis',
    editLinks: true,
    docsDir: 'docs',
    // editLinkText: '在 GitHub 上编辑此页',
    lastUpdated: '上次更新',
    nav: [{
        text: 'Home',
        link: '/'
      },
      {
        text: 'JS',
        link: '/JS/'
      },
      {
        text: 'Vue',
        link: '/Vue/'
      },
      {
        text: 'Webpack',
        link: '/Webpack/'
      }
    ],
    sidebar: {
      '/JS/': [{
        title: 'JS原理',
        collapsable: false,
        children: [
          ['', '开始'],
          ['EventLoop', 'EventLoop事件循环']
        ]
      }],
      '/Vue/': [{
        title: 'Vue原理',
        collapsable: false,
        children: [
          ['', '开始'],
          ['vue3组件通信', 'vue3组件通信'],
          ['实现一个简单的Vue3框架', '实现一个简单的Vue3框架']
        ]
      }]
    }
  }
}