const fs = require('fs');
const path = require('path');
const { ErrorCodes, makeError, errorCodeFromSapStatus } = require('./lib/errors');

const SAP_BASE_URL = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
const SAP_CLIENT = process.env.SAP_CLIENT || '100';
const DEFAULT_TOP = 20;
const MAX_TOP = 100;
const REQUEST_TIMEOUT_MS = Number(process.env.SAP_REQUEST_TIMEOUT_MS || 30000);

let cachedCredentials = null;
let cachedCredentialMtime = 0;
const DISCOVERY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const discoveryCache = new Map(); // key -> { data, cachedAt }
const scenariosCache = { value: null, mtime: 0 };

function createSapContext() {
    return {
        lastGoodCred: null,
    };
}

const defaultSapContext = createSapContext();

function getCredentials() {
    const credFile = process.env.SAP_CREDENTIALS_FILE || path.join(__dirname, '..', 'user.txt');

    try {
        const stat = fs.statSync(credFile);
        if (cachedCredentials && stat.mtimeMs === cachedCredentialMtime) {
            return cachedCredentials;
        }

        const text = fs.readFileSync(credFile, 'utf8');
        const users = [
            ...text.matchAll(/User Name:([^\s\r\n]+)/gi),
            ...text.matchAll(/User ID:([^\s\r\n]+)/gi),
        ].map(match => match[1].trim());

        const passwords = [
            ...text.matchAll(/\u5bc6\u7801[:\uff1a]?([^\s\r\n]+)/g),
            ...text.matchAll(/\u6216\u8005\u8fd9\u4e2a[:\uff1a]([^\s\r\n]+)/g),
        ].map(match => match[1].trim());

        cachedCredentials = {
            users: [...new Set(users)],
            passwords: [...new Set(passwords)],
        };
        cachedCredentialMtime = stat.mtimeMs;
        return cachedCredentials;
    } catch (err) {
        throw new Error(`SAP_CREDENTIALS: Cannot read cred file "${credFile}": ${err.message}`);
    }
}

function buildBasicAuth(user, pass) {
    return Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
}

async function sapFetch(urlPath, context = defaultSapContext) {
    const { users, passwords } = getCredentials();
    if (!users.length || !passwords.length) {
        throw makeError(ErrorCodes.AUTH_MISSING, 'No SAP credentials found');
    }

    const url = urlPath.startsWith('http') ? urlPath : `${SAP_BASE_URL}${urlPath}`;
    let lastStatus = 0;
    let lastBody = '';

    const attempts = [];
    if (context.lastGoodCred) {
        attempts.push(context.lastGoodCred);
    }

    for (const user of users) {
        for (const password of passwords) {
            const cred = { user, password };
            if (!context.lastGoodCred || cred.user !== context.lastGoodCred.user || cred.password !== context.lastGoodCred.password) {
                attempts.push(cred);
            }
        }
    }

    for (const cred of attempts) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const resp = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${buildBasicAuth(cred.user, cred.password)}`,
                    Accept: 'application/json',
                    'sap-client': SAP_CLIENT,
                },
                signal: controller.signal,
            });

            lastStatus = resp.status;

            if (resp.ok) {
                context.lastGoodCred = cred;
                const text = await resp.text();
                try {
                    return JSON.parse(text);
                } catch {
                    return text;
                }
            }

            lastBody = await resp.text().catch(() => '');
            if (resp.status !== 401 && resp.status !== 403) {
                break;
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                throw makeError(ErrorCodes.SAP_TIMEOUT, `Request timed out after ${REQUEST_TIMEOUT_MS}ms`, { retryable: true });
            }
            lastBody = err.message;
        } finally {
            clearTimeout(timeout);
        }
    }

    const code = lastStatus ? errorCodeFromSapStatus(lastStatus) : ErrorCodes.SAP_NETWORK_ERROR;
    const retryable = lastStatus === 401 || lastStatus === 403 || lastStatus === 502 || lastStatus === 503 || lastStatus === 504;
    throw makeError(
        code,
        lastBody.substring(0, 500) || `HTTP ${lastStatus || 'network error'}`,
        { sapStatus: lastStatus || undefined, retryable }
    );
}

function isV2(url) {
    return /\/sap\/opu\/odata\/sap\//i.test(url) && !/\/sap\/opu\/odata4\//i.test(url);
}

function isV4(url) {
    return /\/sap\/opu\/odata4\//i.test(url);
}

function extractRows(data) {
    if (data && data.d && Array.isArray(data.d.results)) return data.d.results;
    if (data && Array.isArray(data.value)) return data.value;
    return [];
}

async function discoverEntitySets(baseUrl, context = defaultSapContext) {
    const cached = discoveryCache.get(baseUrl);
    if (cached && Date.now() - cached.cachedAt < DISCOVERY_TTL_MS) {
        return cached.data;
    }

    const discovered = [];

    if (isV4(baseUrl)) {
        try {
            const data = await sapFetch(`${baseUrl}/?sap-client=${SAP_CLIENT}`, context);
            for (const entry of Array.isArray(data.value) ? data.value : []) {
                if (entry && entry.url && (!entry.kind || entry.kind === 'EntitySet')) {
                    discovered.push({ name: entry.url, url: entry.url });
                }
            }
        } catch (_) {
            // Discovery failure is non-fatal.
        }
    }

    if (isV2(baseUrl)) {
        try {
            const data = await sapFetch(`${baseUrl}/?$format=json&sap-client=${SAP_CLIENT}`, context);
            const sets = data && data.d && Array.isArray(data.d.EntitySets) ? data.d.EntitySets : [];
            for (const entitySet of sets) {
                discovered.push({ name: entitySet, url: entitySet });
            }
        } catch (_) {
            // Discovery failure is non-fatal.
        }
    }

    discoveryCache.set(baseUrl, { data: discovered, cachedAt: Date.now() });
    return discovered;
}

function buildQueryPath(baseUrl, entityName, filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const separator = baseUrl.includes('?') ? '&' : '?';
    let query = `${baseUrl}/${entityName}${separator}${isV2(baseUrl) ? '$format=json&' : ''}sap-client=${SAP_CLIENT}&$top=${t}`;

    if (filter) {
        query += `&$filter=${encodeURIComponent(filter)}`;
    }

    return query;
}

function normalizeScenarioKey(code, title) {
    const normalizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);

    return normalizedTitle ? `${code.toLowerCase()}_${normalizedTitle}` : code.toLowerCase();
}

function getScenarioFilesMaxMtime(scenarioDir) {
    let maxMtime = 0;
    try {
        const entries = fs.readdirSync(scenarioDir);
        for (const fileName of entries) {
            if (/\.txt$/i.test(fileName) && /SAP_COM_\d{4}/i.test(fileName)) {
                const stat = fs.statSync(path.join(scenarioDir, fileName));
                if (stat.mtimeMs > maxMtime) {
                    maxMtime = stat.mtimeMs;
                }
            }
        }
    } catch {
        // Directory unreadable; cache will be invalidated.
    }
    return maxMtime;
}

function parseScenarioFiles() {
    const scenarioDir = process.env.SAP_SCENARIO_DIR || path.join(__dirname, '..');
    const files = fs.readdirSync(scenarioDir)
        .filter(fileName => /\.txt$/i.test(fileName) && /SAP_COM_\d{4}/i.test(fileName));

    const scenarios = files.map(fileName => {
        const fullPath = path.join(scenarioDir, fileName);
        const content = fs.readFileSync(fullPath, 'utf8');
        const codeMatch = fileName.match(/SAP_COM_\d{4}/i);
        const code = codeMatch ? codeMatch[0].toUpperCase() : 'SAP_COM_UNKNOWN';
        const title = fileName
            .replace(/\.txt$/i, '')
            .split('-')
            .pop()
            .trim() || code;
        const allowedHost = new URL(SAP_BASE_URL).host;
        const urls = (content.match(/https?:\/\/[^\s"'<>]+/g) || [])
            .map(url => url.replace(/[),.;\uff0c\u3002]+$/g, ''))
            .filter(url => {
                try {
                    return new URL(url).host === allowedHost;
                } catch {
                    return false;
                }
            });

        return {
            key: normalizeScenarioKey(code, title),
            code,
            title,
            fileName,
            urls: [...new Set(urls)],
        };
    });

    return { scenarios, maxMtime: getScenarioFilesMaxMtime(scenarioDir) };
}

function getScenarios() {
    const scenarioDir = process.env.SAP_SCENARIO_DIR || path.join(__dirname, '..');
    const currentMaxMtime = getScenarioFilesMaxMtime(scenarioDir);

    if (!scenariosCache.value || currentMaxMtime > scenariosCache.mtime) {
        const result = parseScenarioFiles();
        scenariosCache.value = result.scenarios;
        scenariosCache.mtime = result.maxMtime;
    }

    return scenariosCache.value;
}

async function queryScenario(scenarioKey, filter, top, context = defaultSapContext) {
    const scenario = getScenarios().find(item => item.key === scenarioKey);
    if (!scenario) {
        throw makeError(ErrorCodes.SCENARIO_NOT_FOUND, `Unknown scenario key: ${scenarioKey}`);
    }
    if (!scenario.urls.length) {
        throw makeError(ErrorCodes.NO_ENDPOINT, 'No SAP endpoint URL configured for this scenario');
    }

    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const results = { scenario, objects: [], summary: {} };

    for (const fullUrl of scenario.urls) {
        const base = new URL(fullUrl);
        const basePath = `${base.pathname}${base.search || ''}`.replace(/\/$/, '');
        const entitySets = await discoverEntitySets(basePath, context);
        const candidates = [basePath, ...entitySets.map(entitySet => `${basePath}/${entitySet.url}`)];

        for (const candidate of candidates) {
            const entityName = candidate.split('/').pop() || 'Entity';
            if (results.summary[entityName] !== undefined) continue;

            try {
                const data = await sapFetch(buildQueryPath(basePath, entityName, filter, t), context);
                const rows = extractRows(data);
                results.summary[entityName] = rows.length;

                if (rows.length > 0) {
                    results.objects.push({ entityName, count: rows.length, rows });
                }
            } catch (err) {
                if (err.sapStatus !== 401 && err.sapStatus !== 403) {
                    results.summary[entityName] = -1;
                }
            }
        }
    }

    return results;
}

module.exports = {
    createSapContext,
    sapFetch,
    getCredentials,
    buildBasicAuth,
    extractRows,
    isV2,
    isV4,
    discoverEntitySets,
    buildQueryPath,
    normalizeScenarioKey,
    getScenarios,
    queryScenario,
    makeError,
    ErrorCodes,
    SAP_BASE_URL,
    SAP_CLIENT,
    DEFAULT_TOP,
    MAX_TOP,
    REQUEST_TIMEOUT_MS,
};
