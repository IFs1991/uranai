// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // environment: 'jsdom', // ← コメントアウトまたは削除
    environment: 'node',   // ← Node.js 環境に変更
    globals: true,
    // setup.js は kv 関連のモック削除後も他のモックで使われている可能性があるため残します
    // もし setup.js の内容が不要になった場合は、この行も削除して構いません。
    // setupFiles: ['./test/setup.js'], // ← KV関連のテストではsetupを無効化
    // environmentOptions は jsdom 用の設定なので削除またはコメントアウトします
    // environmentOptions: {
    //   jsdom: {
    //     resources: 'usable',
    //     url: 'http://localhost/',
    //   },
    // },
  },
});