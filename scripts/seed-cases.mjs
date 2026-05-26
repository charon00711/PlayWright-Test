#!/usr/bin/env node
/** 将 data/cases.json 与现有 spec 对齐（已预置，可重复执行） */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casesPath = path.join(root, 'data', 'cases.json');

if (fs.existsSync(casesPath)) {
  const data = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
  console.log(`cases.json 已有 ${data.cases?.length ?? 0} 条用例`);
} else {
  console.log('cases.json 不存在，请先运行平台初始化');
}
