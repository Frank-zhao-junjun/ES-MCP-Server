const fs = require('fs');
const path = require('path');
const { parseCredentials } = require('./lib/credentials');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const DEFAULT_BASE_URL = 'https://my200967-api.s4hana.sapcloud.cn';
const DEFAULT_CLIENT = '100';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CACHE_TTL_MS = 0;

function loadConfig() {
  const rootDir = path.join(__dirname, '..');
  const credFile = process.env.SAP_CREDENTIALS_FILE
    ? path.isAbsolute(process.env.SAP_CREDENTIALS_FILE)
      ? process.env.SAP_CREDENTIALS_FILE
      : path.join(__dirname, process.env.SAP_CREDENTIALS_FILE)
    : path.join(rootDir, 'user.txt');

  return {
    baseUrl: (process.env.SAP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    client: process.env.SAP_CLIENT || DEFAULT_CLIENT,
    credentialsFile: credFile,
    scenarioDir: process.env.SAP_SCENARIO_DIR || rootDir,
    timeoutMs: Number(process.env.SAP_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    cacheTtlMs: Number(process.env.SAP_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS),
    mcpPort: Number(process.env.MCP_PORT || 3000),
    mcpBindAddress: process.env.MCP_BIND_ADDRESS || '127.0.0.1',
    enableHttp: String(process.env.MCP_ENABLE_HTTP_TRANSPORT).toLowerCase() === 'true',
    apiKey: process.env.MCP_API_KEY || 'change-me',
    requireApiKey: String(process.env.MCP_REQUIRE_API_KEY).toLowerCase() === 'true',
  };
}

const config = loadConfig();

function getCredentials() {
  if (!fs.existsSync(config.credentialsFile)) {
    throw new Error(`SAP credentials file not found: ${config.credentialsFile}`);
  }
  return parseCredentials(config.credentialsFile);
}

function formatSapError(status, body) {
  if (status === 401) {
    return { error: 'SAP_AUTH_FAILED', message: 'SAP rejected credentials; check user.txt' };
  }
  if (status === 403) {
    return { error: 'SAP_ARRANGEMENT_REQUIRED', message: 'Communication Arrangement not enabled for this API' };
  }
  if (status === 404) {
    return { error: 'SAP_NOT_FOUND', message: 'Service path or entity not found' };
  }
  return { error: 'SAP_ERROR', status, message: typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500) };
}

const cache = new Map();

function cacheKey(method, url) {
  return `${method}:${url}`;
}

function getCached(key) {
  if (!config.cacheTtlMs) return undefined;
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > config.cacheTtlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key, value) {
  if (!config.cacheTtlMs) return;
  cache.set(key, { ts: Date.now(), value });
}

/**
 * Execute a GET request against SAP OData.
 * Tries every user × password combination until one succeeds.
 *
 * @param {string} url - Full URL or path relative to SAP_BASE_URL
 * @param {{ bypassCache?: boolean, accept?: string }} [options={}]
 * @returns {{ status: number, ok: boolean, text?: string, data?: any, error?: object }}
 */
async function sapGet(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${config.baseUrl}${url}`;
  const key = cacheKey('GET', fullUrl);

  if (!options.bypassCache) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const { users, passwords } = getCredentials();
  if (!users.length || !passwords.length) {
    return { status: 0, ok: false, error: { error: 'SAP_AUTH_FAILED', message: 'No credentials parsed from user.txt' } };
  }

  const accept = options.accept || 'application/json';
  let lastStatus = 0;
  let lastText = '';

  for (const user of users) {
    for (const password of passwords) {
      const auth = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
      try {
        const resp = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: accept,
            'sap-client': config.client,
          },
          signal: AbortSignal.timeout(config.timeoutMs),
        });

        const text = await resp.text();
        lastStatus = resp.status;
        lastText = text;

        if (resp.ok) {
          let data;
          if (accept === 'application/json') {
            try {
              data = text ? JSON.parse(text) : {};
            } catch {
              data = text;
            }
          } else {
            data = text;
          }
          const result = { status: resp.status, ok: true, text, data };
          setCached(key, result);
          return result;
        }
      } catch (err) {
        if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
          return { status: 0, ok: false, error: { error: 'SAP_TIMEOUT', message: err.message } };
        }
        lastStatus = 0;
        lastText = err.message;
      }
    }
  }

  const result = { status: lastStatus, ok: false, text: lastText, error: formatSapError(lastStatus, lastText) };
  return result;
}

/**
 * Parse $metadata XML and extract properties for a given EntityType.
 * Returns simple array of property names + types (best-effort, no XML parser dependency).
 *
 * @param {string} xmlText
 * @param {string} entityName
 * @returns {Array<{name: string, type: string}>}
 */
function parseMetadata(xmlText, entityName) {
  if (!xmlText || typeof xmlText !== 'string') return [];

  // Find EntityType element matching entity name
  const entityTypeRegex = new RegExp(`<EntityType[^>]*\\bName="${entityName}"[^>]*>([\\s\\S]*?)</EntityType>`, 'i');
  const entityMatch = xmlText.match(entityTypeRegex);
  if (!entityMatch) return [];

  const body = entityMatch[1];
  const properties = [];

  // Match Property elements inside the EntityType
  const propertyRegex = /<Property[^>]*\bName="([^"]+)"[^>]*\bType="([^"]+)"[^>]*\/?>/gi;
  let m;
  while ((m = propertyRegex.exec(body)) !== null) {
    properties.push({ name: m[1], type: m[2] });
  }

  // Also include Key properties if present
  const keyRegex = /<PropertyRef[^>]*\bName="([^"]+)"\s*\/?>/gi;
  const keyNames = new Set();
  while ((m = keyRegex.exec(body)) !== null) {
    keyNames.add(m[1]);
  }

  return properties.map((p) => ({ ...p, isKey: keyNames.has(p.name) }));
}

/**
 * Fetch and parse $metadata for a service path.
 *
 * @param {string} servicePath - e.g. /sap/opu/odata/sap/API_PRODUCT_SRV
 * @param {string} entityName - e.g. A_Product
 * @returns {{ status: number, ok: boolean, properties?: Array, error?: object }}
 */
async function sapGetEntitySchema(servicePath, entityName) {
  const metadataUrl = `${servicePath.replace(/\/$/, '')}/$metadata`;
  const result = await sapGet(metadataUrl, { accept: 'application/xml' });
  if (!result.ok) return result;

  const properties = parseMetadata(result.data, entityName);
  return { status: result.status, ok: true, properties };
}

module.exports = {
  config,
  loadConfig,
  getCredentials,
  sapGet,
  sapGetEntitySchema,
  parseMetadata,
  formatSapError,
};
