#!/usr/bin/env node

import { parseAndGenerateEnv, setDebug } from './util'
import fs from "node:fs"

// 执行核心逻辑
(async () => {
  const args = process.argv.slice(2);
  const isDebug = args.includes('--debug');
  if (isDebug) {
    setDebug(true);
  }

  try {
    const result = await parseAndGenerateEnv();
    if (!result) return;
    const { target, content } = result;
    if (isDebug && content) {
      console.log(content);
    }
    console.log("write config to " + target);
    if (content) {
      fs.writeFileSync(target, content, "utf-8");
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
