const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';
const SAP_CLIENT = '100';
const TOP_N = '20';
const scenarioDir = __dirname;

app.use(express.static(path.join(__dirname, 'public')));

function parseCredentialsFromUserTxt() {
  const filePath = path.join(__dirname, 'user.txt');
  const text = fs.readFileSync(filePath, 'utf8');

  const userNameMatch = text.match(/User Name:([^\s\r\n]+)/i);
  const userIdMatch = text.match(/User ID:([^\s\r\n]+)/i);
  const passwordMatch = text.match(/密码[:：]([^\s\r\n]+)/);
  const altPasswordMatch = text.match(/或者这个[:：]([^\s\r\n]+)/);

  const users = [];
  if (userNameMatch && userNameMatch[1]) users.push(userNameMatch[1].trim());
  // Trying User ID on every request can trigger frequent lockout; keep it as fallback only.
  if (userIdMatch && userIdMatch[1]) users.push(userIdMatch[1].trim());

  const passwords = [];
  // Prefer the alternate password first because it is currently the validated one.
  if (altPasswordMatch && altPasswordMatch[1]) passwords.push(altPasswordMatch[1].trim());
  if (passwordMatch && passwordMatch[1]) passwords.push(passwordMatch[1].trim());

  return { users, passwords };
}

function buildBaseAuth(user, pass) {
  return Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
}

async function fetchWithAnyCredential(fullPathWithQuery) {
  const { users, passwords } = parseCredentialsFromUserTxt();
  if (!users.length || !passwords.length) {
    throw new Error('无法从 user.txt 解析 SAP 凭据');
  }

  const url = `${SAP_HOST}${fullPathWithQuery}`;
  let lastError = null;

  if (!fetchWithAnyCredential.lastGood) {
    fetchWithAnyCredential.lastGood = null;
  }

  const attempts = [];
  const userNameOnly = users.slice(0, 1);
  for (const u of userNameOnly) {
    for (const p of passwords) attempts.push({ user: u, password: p });
  }

  if (fetchWithAnyCredential.lastGood) {
    attempts.unshift(fetchWithAnyCredential.lastGood);
  }

  for (const attempt of attempts) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${buildBaseAuth(attempt.user, attempt.password)}`,
          Accept: 'application/json',
          'sap-client': SAP_CLIENT,
        },
      });

      if (resp.ok) {
        fetchWithAnyCredential.lastGood = { user: attempt.user, password: attempt.password };
        return await resp.json();
      }

      lastError = new Error(`SAP HTTP ${resp.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('SAP 请求失败');
}

function cleanFoundUrl(urlText) {
  return urlText.replace(/[),.;，。；]+$/g, '');
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizePathWithQuery(urlText) {
  const u = new URL(urlText);
  return `${u.pathname}${u.search || ''}`;
}

function withQuery(pathWithQuery, key, value) {
  const hasQuery = pathWithQuery.includes('?');
  const joiner = hasQuery ? '&' : '?';
  return `${pathWithQuery}${joiner}${key}=${value}`;
}

function ensureClient(pathWithQuery) {
  return /[?&]sap-client=/i.test(pathWithQuery) ? pathWithQuery : withQuery(pathWithQuery, 'sap-client', SAP_CLIENT);
}

function isServiceRootPath(pathWithQuery) {
  const p = pathWithQuery.split('?')[0].replace(/\/$/, '');
  const isV2Root = /\/sap\/opu\/odata\/sap\/[^/;?]+(?:;v=\d+)?$/i.test(p);
  const isV4Root = /\/sap\/opu\/odata4\/sap\/.+\/\d{4}$/i.test(p);
  return isV2Root || isV4Root;
}

function buildEntityQueryPath(pathWithQuery, filter) {
  let q = ensureClient(pathWithQuery);

  if (/\/sap\/opu\/odata\/sap\//i.test(q) && !/[?&]\$format=/i.test(q)) {
    q = withQuery(q, '$format', 'json');
  }

  if (!isServiceRootPath(q) && !/[?&]\$top=/i.test(q)) {
    q = withQuery(q, '$top', TOP_N);
  }

  if (filter) {
    q = withQuery(q, '$filter', encodeURIComponent(filter));
  }

  return q;
}

function extractRows(data) {
  if (data && data.d && Array.isArray(data.d.results)) {
    return data.d.results;
  }

  if (data && Array.isArray(data.value)) {
    return data.value;
  }

  return [];
}

function getEntityNameFromPath(pathValue) {
  const pathOnly = pathValue.split('?')[0];
  return pathOnly.split('/').pop() || 'Entity';
}

function isServiceDocumentRows(rows) {
  if (!rows.length) return false;
  return rows.every(
    (r) => r && typeof r === 'object' && 'name' in r && 'url' in r && ('kind' in r || 'title' in r)
  );
}

function parseScenarioFiles() {
  const files = fs
    .readdirSync(scenarioDir)
    .filter((f) => /^接口地址（SAP_COM_\d{4}）.*\.txt$/i.test(f));

  const scenarios = [];

  for (const fileName of files) {
    const fullPath = path.join(scenarioDir, fileName);
    const content = fs.readFileSync(fullPath, 'utf8');

    const codeMatch = fileName.match(/SAP_COM_\d{4}/i);
    const code = codeMatch ? codeMatch[0].toUpperCase() : 'SAP_COM_UNKNOWN';

    let title = fileName
      .replace(/^接口地址（SAP_COM_\d{4}）\s*-\s*/i, '')
      .replace(/\.txt$/i, '')
      .trim();

    if (!title) {
      title = code;
    }

    const key = `${code.toLowerCase()}_${slugify(title)}`;

    const urls = (content.match(/https?:\/\/[^\s"'<>]+/g) || [])
      .map(cleanFoundUrl)
      .filter((u) => u.includes('my200967-api.s4hana.sapcloud.cn'));

    const uniqueUrls = [...new Set(urls)].sort((a, b) => {
      const aIsAttachment = /API_CV_ATTACHMENT_SRV/i.test(a);
      const bIsAttachment = /API_CV_ATTACHMENT_SRV/i.test(b);
      if (aIsAttachment === bIsAttachment) return 0;
      return aIsAttachment ? 1 : -1;
    });

    scenarios.push({
      key,
      code,
      title,
      fileName,
      urls: uniqueUrls,
    });
  }

  scenarios.sort((a, b) => {
    const na = Number((a.code.match(/\d+/) || ['0'])[0]);
    const nb = Number((b.code.match(/\d+/) || ['0'])[0]);
    if (na !== nb) return na - nb;
    return a.title.localeCompare(b.title);
  });

  return scenarios;
}

let scenariosCache = parseScenarioFiles();
const discoveryCache = new Map();

const scenarioEntityPriority = {
  SAP_COM_0101: ['A_PurchaseContract', 'A_PurchaseContractItem'],
};

function sortCandidatesForScenario(scenario, candidates) {
  const preferred = scenarioEntityPriority[scenario.code] || [];
  if (!preferred.length) return candidates;

  const rank = (pathValue) => {
    const entityName = getEntityNameFromPath(pathValue);
    const idx = preferred.indexOf(entityName);
    return idx === -1 ? 999 : idx;
  };

  return [...candidates].sort((a, b) => rank(a) - rank(b));
}

async function discoverEntityPaths(basePathWithQuery) {
  const cacheKey = basePathWithQuery;
  if (discoveryCache.has(cacheKey)) {
    return discoveryCache.get(cacheKey);
  }

  const baseNoQuery = basePathWithQuery.split('?')[0].replace(/\/$/, '');
  const isV2 = /\/sap\/opu\/odata\/sap\//i.test(baseNoQuery);
  const isV4 = /\/sap\/opu\/odata4\//i.test(baseNoQuery);

  const discovered = [];

  if (isV2) {
    const serviceDoc = `${baseNoQuery}/?$format=json&sap-client=${SAP_CLIENT}`;
    try {
      const data = await fetchWithAnyCredential(serviceDoc);
      const entitySets = data && data.d && Array.isArray(data.d.EntitySets) ? data.d.EntitySets : [];
      for (const es of entitySets) {
        discovered.push(`${baseNoQuery}/${es}`);
      }
    } catch (_) {
      // ignore discovery failures and keep fallback attempts
    }
  }

  if (isV4) {
    const serviceDoc = `${baseNoQuery}/?sap-client=${SAP_CLIENT}`;
    try {
      const data = await fetchWithAnyCredential(serviceDoc);
      const entitySets = Array.isArray(data && data.value) ? data.value : [];
      for (const entry of entitySets) {
        if (entry && entry.url && (!entry.kind || entry.kind === 'EntitySet')) {
          discovered.push(`${baseNoQuery}/${entry.url}`);
        }
      }
    } catch (_) {
      // ignore discovery failures and keep fallback attempts
    }
  }

  discoveryCache.set(cacheKey, discovered);
  return discovered;
}

async function queryScenario(scenario, filter) {
  let first200NoRows = null;
  let lastErr = null;

  for (const fullUrl of scenario.urls) {
    const basePathWithQuery = normalizePathWithQuery(fullUrl);
    const candidates = [basePathWithQuery, ...(await discoverEntityPaths(basePathWithQuery))];
    const uniqueCandidates = sortCandidatesForScenario(scenario, [...new Set(candidates)]);

    for (const c of uniqueCandidates) {
      const queryPath = buildEntityQueryPath(c, filter);
      try {
        const data = await fetchWithAnyCredential(queryPath);
        const rows = extractRows(data);

        if (rows.length > 0 && !isServiceDocumentRows(rows)) {
          return {
            rows,
            endpointPath: queryPath,
            baseUrl: fullUrl,
          };
        }

        if (!first200NoRows) {
          first200NoRows = {
            rows: [],
            endpointPath: queryPath,
            baseUrl: fullUrl,
          };
        }
      } catch (err) {
        lastErr = err;
      }
    }
  }

  if (first200NoRows) {
    return first200NoRows;
  }

  throw lastErr || new Error('无可用接口候选路径');
}

function isChildEntity(entityName) {
  return /(Item|Items|Partner|Address|Note|Scale|Valdty|Amount|Condition|Schedule|Component|Operation|Text|Account)/i.test(
    entityName
  );
}

function findSharedDocKey(headerRow, childRow) {
  const keys = [
    'PurchaseOrder',
    'SalesOrder',
    'PurchaseContract',
    'ProductionOrder',
    'BillingDocument',
    'DeliveryDocument',
    'OutboundDelivery',
    'MaterialDocument',
    'Reservation',
    'InspectionLot',
    'SupplierInvoice',
    'RFQ',
    'RequestForQuotation',
    'SchedulingAgreement',
  ];

  for (const k of keys) {
    if (headerRow && childRow && k in headerRow && k in childRow) {
      return k;
    }
  }

  return '';
}

function determineViewMode(objects) {
  if (objects.length <= 1) {
    return { viewMode: 'single' };
  }

  const headerCandidate = objects.find((o) => !isChildEntity(o.entityName));
  const childCandidate = objects.find((o) => isChildEntity(o.entityName));

  if (headerCandidate && childCandidate && headerCandidate.rows.length && childCandidate.rows.length) {
    const sharedKey = findSharedDocKey(headerCandidate.rows[0], childCandidate.rows[0]);
    if (sharedKey) {
      return {
        viewMode: 'masterDetail',
        headerEntity: headerCandidate.entityName,
        childEntity: childCandidate.entityName,
        sharedKey,
      };
    }
  }

  return { viewMode: 'tabs' };
}

async function queryScenarioObjects(scenario, filter) {
  const objects = [];
  const seenEntity = new Set();
  const probeMap = new Map();
  let first200NoRows = null;
  let lastErr = null;

  for (const fullUrl of scenario.urls) {
    const basePathWithQuery = normalizePathWithQuery(fullUrl);
    const candidates = [basePathWithQuery, ...(await discoverEntityPaths(basePathWithQuery))];
    const uniqueCandidates = sortCandidatesForScenario(scenario, [...new Set(candidates)]).slice(0, 14);

    for (const c of uniqueCandidates) {
      const queryPath = buildEntityQueryPath(c, filter);
      const entityName = getEntityNameFromPath(queryPath);

      if (seenEntity.has(entityName)) {
        continue;
      }

      try {
        const data = await fetchWithAnyCredential(queryPath);
        const rows = extractRows(data);

        if (!isServiceDocumentRows(rows) && !probeMap.has(entityName)) {
          probeMap.set(entityName, rows.length);
        }

        if (rows.length > 0 && !isServiceDocumentRows(rows)) {
          objects.push({
            entityName,
            endpointPath: queryPath,
            baseUrl: fullUrl,
            count: rows.length,
            rows,
          });
          seenEntity.add(entityName);
        } else if (!first200NoRows) {
          first200NoRows = {
            entityName,
            endpointPath: queryPath,
            baseUrl: fullUrl,
            count: 0,
            rows: [],
          };
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (objects.length >= 6) {
      break;
    }
  }

  if (!objects.length) {
    if (first200NoRows) {
      objects.push(first200NoRows);
    } else {
      throw lastErr || new Error('无可用接口候选路径');
    }
  }

  const mode = determineViewMode(objects);
  return {
    objects,
    objectSummary: Array.from(probeMap.entries()).map(([entityName, count]) => ({ entityName, count })),
    ...mode,
  };
}

app.get('/api/scenarios', (req, res) => {
  scenariosCache = parseScenarioFiles();
  res.json({
    count: scenariosCache.length,
    scenarios: scenariosCache.map((s) => ({
      key: s.key,
      code: s.code,
      title: s.title,
      fileName: s.fileName,
      urlCount: s.urls.length,
    })),
  });
});

app.get('/api/scenario/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const filter = req.query.filter ? String(req.query.filter).trim() : '';
    const scenario = scenariosCache.find((s) => s.key === key);

    if (!scenario) {
      return res.status(404).json({ error: `未知场景标识: ${key}` });
    }

    if (!scenario.urls.length) {
      return res.status(400).json({ error: '场景文件中未找到 SAP 主机 URL' });
    }

    const result = await queryScenarioObjects(scenario, filter);

    res.json({
      scenario: {
        key: scenario.key,
        code: scenario.code,
        title: scenario.title,
      },
      viewMode: result.viewMode,
      headerEntity: result.headerEntity || '',
      childEntity: result.childEntity || '',
      sharedKey: result.sharedKey || '',
      objects: result.objects,
      objectSummary: result.objectSummary || [],
      count: result.objects.reduce((n, o) => n + o.count, 0),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: '查询 SAP 场景失败',
      detail: err.message,
    });
  }
});

app.get('/api/status-board', async (req, res) => {
  try {
    scenariosCache = parseScenarioFiles();
    const rows = [];

    for (const scenario of scenariosCache) {
      if (!scenario.urls.length) {
        rows.push({
          key: scenario.key,
          code: scenario.code,
          title: scenario.title,
          status: 'red',
          message: '未找到 SAP 主机 URL',
          count: 0,
          endpointPath: '',
        });
        continue;
      }

      try {
        const result = await queryScenario(scenario, '');
        rows.push({
          key: scenario.key,
          code: scenario.code,
          title: scenario.title,
          status: result.rows.length > 0 ? 'green' : 'yellow',
          message: result.rows.length > 0 ? '正常' : '正常但无数据',
          count: result.rows.length,
          endpointPath: result.endpointPath,
        });
      } catch (err) {
        rows.push({
          key: scenario.key,
          code: scenario.code,
          title: scenario.title,
          status: 'red',
          message: err.message,
          count: 0,
          endpointPath: '',
        });
      }
    }

    res.json({
      total: rows.length,
      green: rows.filter((r) => r.status === 'green').length,
      yellow: rows.filter((r) => r.status === 'yellow').length,
      red: rows.filter((r) => r.status === 'red').length,
      rows,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: '状态看板巡检失败', detail: err.message });
  }
});

app.get('/api/outbound-delivery/:salesOrder', async (req, res) => {
  try {
    const salesOrder = req.params.salesOrder;
    const filter = `SalesOrder eq '${salesOrder}'`;
    
    // 出库交货 API 端点
    const basePathWithQuery = '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader';
    const queryPath = buildEntityQueryPath(basePathWithQuery, filter);
    
    console.log(`正在查询销售订单的出库交货: ${salesOrder}`);
    console.log(`查询路径: ${queryPath}`);
    
    const data = await fetchWithAnyCredential(queryPath);
    const rows = extractRows(data);
    
    res.json({
      salesOrder,
      count: rows.length,
      deliveries: rows,
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: '查询出库交货失败',
      detail: err.message,
    });
  }
});

app.get('/api/field-labels', (req, res) => {
  res.json({
    BusinessPartner: '业务伙伴',
    BusinessPartnerCategory: '业务伙伴类别',
    BusinessPartnerName: '业务伙伴名称',
    Customer: '客户',
    CustomerName: '客户名称',
    Product: '产品',
    ProductType: '产品类型',
    ProductGroup: '产品组',
    BaseUnit: '基本计量单位',
    CreationDate: '创建日期',
    LastChangeDate: '最后变更日期',
    CompanyCode: '公司代码',
    SalesOrganization: '销售组织',
    DistributionChannel: '分销渠道',
    Division: '产品分部',
  });
});

app.listen(PORT, () => {
  console.log(`SAP UI 服务已启动: http://localhost:${PORT}`);
});
