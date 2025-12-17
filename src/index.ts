#!/usr/bin/env node

import { initEnv } from './util'

// 执行核心逻辑
try {
  initEnv();
} catch (e) {
  console.error(e);
  process.exit(1);
}
