const fs = require('fs');
const path = require('path');

/**
 * Parse SAP credentials from a user.txt file.
 * Supports both Chinese and English formats (same regex set as probe-sap-connectivity.js).
 *
 * @param {string} filePath - Path to user.txt
 * @returns {{ users: string[], passwords: string[] }}
 */
function parseCredentials(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');

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

module.exports = { parseCredentials };
