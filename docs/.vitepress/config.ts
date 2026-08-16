import { defineConfig } from 'vitepress'

const repository = 'https://github.com/Sunwood-ai-labs/html-share-tailscale'

const englishNav = [
  {
    text: 'Guides',
    items: [
      { text: 'Setup', link: '/guide/setup' },
      { text: 'Usage', link: '/guide/usage' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Threat model', link: '/guide/threat-model' },
      { text: 'Troubleshooting', link: '/guide/troubleshooting' },
    ],
  },
  { text: '日本語', link: '/ja/' },
  { text: 'GitHub', link: repository },
]

const japaneseNav = [
  {
    text: 'ガイド',
    items: [
      { text: '初回セットアップ', link: '/ja/guide/setup' },
      { text: '使い方', link: '/ja/guide/usage' },
      { text: 'アーキテクチャ', link: '/ja/guide/architecture' },
      { text: 'セキュリティ設計', link: '/ja/guide/threat-model' },
      { text: 'トラブルシューティング', link: '/ja/guide/troubleshooting' },
    ],
  },
  { text: 'English', link: '/' },
  { text: 'GitHub', link: repository },
]

const englishSidebar = [
  {
    text: 'Guides',
    items: [
      { text: 'Setup', link: '/guide/setup' },
      { text: 'Usage', link: '/guide/usage' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Threat model', link: '/guide/threat-model' },
      { text: 'Troubleshooting', link: '/guide/troubleshooting' },
    ],
  },
]

const japaneseSidebar = [
  {
    text: 'ガイド',
    items: [
      { text: '初回セットアップ', link: '/ja/guide/setup' },
      { text: '使い方', link: '/ja/guide/usage' },
      { text: 'アーキテクチャ', link: '/ja/guide/architecture' },
      { text: 'セキュリティ設計', link: '/ja/guide/threat-model' },
      { text: 'トラブルシューティング', link: '/ja/guide/troubleshooting' },
    ],
  },
]

export default defineConfig({
  title: 'HTML Share — Tailscale',
  description: 'A local-first HTML dashboard shared through Tailscale Serve.',
  lang: 'en-US',
  base: '/html-share-tailscale/',
  cleanUrls: true,
  lastUpdated: true,
  locales: {
    root: { label: 'English', lang: 'en' },
    ja: { label: '日本語', lang: 'ja' },
  },
  head: [
    ['link', { rel: 'icon', href: '/html-share-tailscale/brand/html-share-tailscale-mark.svg' }],
  ],
  themeConfig: {
    logo: {
      src: '/brand/html-share-tailscale-mark.svg',
      alt: 'HTML Share Tailscale',
    },
    socialLinks: [{ icon: 'github', link: repository }],
    search: { provider: 'local' },
    locales: {
      root: {
        label: 'English',
        nav: englishNav,
        sidebar: { '/guide/': englishSidebar },
      },
      ja: {
        label: '日本語',
        nav: japaneseNav,
        sidebar: { '/ja/guide/': japaneseSidebar },
      },
    },
    footer: {
      message: 'Built for private Tailnets. No AWS account required.',
      copyright: 'Copyright © 2026 Sunwood AI Labs',
    },
  },
})
