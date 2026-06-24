#!/usr/bin/env node
/**
 * Quick SAP connectivity probe for ES-MCP-Server (repo root).
 * Usage: node scripts/probe-sap-connectivity.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const USER_FILE = process.env.SAP_CREDENTIALS_FILE || path.join(ROOT, 'user.txt');
const BASE = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
const CLIENT = process.env.SAP_CLIENT || '100';

function parseCredentials(text) {
  const users = [
    ...text.matchAll(/User Name:\s*([^\s\r\n]+)/gi),
    ...text.matchAll(/User ID:\s*([^\s\r\n]+)/gi),
    ...text.matchAll(/(?:接口调用的)?通信用户[：:]\s*([^\s\r\n]+)/gi),
  ].map((m) => m[1].trim());
  const passwords = [
    ...text.matchAll(/密码[：:]\s*([^\s\r\n]+)/g),
    ...text.matchAll(/或者这个[：:]\s*([^\s\r\n]+)/g),
    ...text.matchAll(/^Password(?:Alt)?:\s*(.+)$/gim),
  ].map((m) => m[1].trim());
  return {
    users: [...new Set(users)],
    passwords: [...new Set(passwords)],
  };
}

const { ENDPOINTS, resolvePath } = require(path.join(__dirname, '..', 'MCP Server', 'lib', 'sap-endpoints.js'));

async function probe(url, user, password) {
  const auth = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'sap-client': CLIENT,
    },
    signal: AbortSignal.timeout(25000),
  });
  return resp.status;
}

async function main() {
  const text = fs.readFileSync(USER_FILE, 'utf8');
  const { users, passwords } = parseCredentials(text);
  if (!users.length || !passwords.length) {
    console.error('No credentials parsed from', USER_FILE);
    process.exit(1);
  }

  const results = [];
  for (const ep of ENDPOINTS) {
    const url = `${BASE}${resolvePath(ep, CLIENT)}`;
    let status = 0;
    let note = 'FAIL';
    let credUsed = '';

    for (const user of users) {
      for (const password of passwords) {
        try {
          status = await probe(url, user, password);
          if (status >= 200 && status < 300) {
            note = 'OK';
            credUsed = user;
            break;
          }
        } catch (err) {
          status = 0;
          note = err.message || 'ERR';
        }
      }
      if (note === 'OK') break;
    }

    const result = {
      分类: ep.分类,
      通信场景: ep.场景 || '',
      接口名称: ep.名称,
      方法: ep.方法,
      接口地址: url,
      协议: ep.协议,
      鉴权: 'Basic Auth + sap-client',
      连通性: note === 'OK' ? `OK(${status})` : `FAIL(${status || note})`,
      备注: ep.备注
        ? (credUsed ? `${ep.备注}; user=${credUsed}` : ep.备注)
        : credUsed
          ? `user=${credUsed}`
          : status === 403
            ? '需开通 Communication Arrangement'
            : status === 404
              ? '服务路径或实体不存在'
              : 'all credential combos failed',
    };
    if (ep.读取示例) result.读取示例 = ep.读取示例;
    results.push(result);
  }

  const out = path.join(ROOT, 'Probe_Latest.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
  console.error('Wrote', out);

  const ok = results.filter((r) => r.连通性.startsWith('OK'));
  const fail403 = results.filter((r) => r.连通性.includes('403'));
  const fail404 = results.filter((r) => r.连通性.includes('404'));
  console.error(`\n--- 汇总 ---`);
  console.error(`总计 ${results.length} | OK ${ok.length} | 403 ${fail403.length} | 404 ${fail404.length} | 其他 ${results.length - ok.length - fail403.length - fail404.length}`);

  const allFailed = results.every((r) => !r.连通性.startsWith('OK'));
  if (allFailed) {
    console.error('\n--- 诊断 ---');
    console.error(`凭证文件: ${USER_FILE}`);
    console.error(`用户: ${users.join(', ')}`);
    console.error(`密码数量: ${passwords.length}（长度: ${passwords.map((p) => p.length).join(', ')}）`);
    console.error('全部组合均 401 → SAP 拒绝登录（密码错误或用户被锁）');
    console.error('请在 Fiori 打开 Maintain Communication Users → 解锁 EPC_USER → 重置密码');
    console.error('然后更新 user.txt 的 Password: 行，再重新运行本脚本。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
