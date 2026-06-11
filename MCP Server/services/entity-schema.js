const { ErrorCodes, makeError } = require('../lib/errors');
const { getScenarios } = require('../mcp-sap-core');

const METADATA_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map(); // url -> { xml, parsedAt }

function stripXmlNamespaces(xml) {
    // Remove xmlns declarations and namespace prefixes for easier regex parsing
    return xml
        .replace(/\s+xmlns(:\w+)?="[^"]*"/g, '')
        .replace(/<(\/?)[\w-]+:([^\s>/]+)/g, '<$1$2')
        .replace(/\s+[\w-]+:([\w-]+)=/g, ' $1=');
}

function resolveEntityTypeName(xml, name) {
    // 1. Try to find an EntitySet mapping
    const setRegex = new RegExp(`<EntitySet[^>]*Name="${name}"[^>]*EntityType="([^"]+)"[^/]*/>`);
    const setMatch = xml.match(setRegex);
    if (setMatch) {
        // EntityType may be qualified (Namespace.TypeName); strip namespace
        const fullType = setMatch[1];
        return fullType.split('.').pop();
    }

    // 2. Try direct EntityType match
    const typeRegex = new RegExp(`<EntityType[^>]*Name="${name}"`);
    if (typeRegex.test(xml)) {
        return name;
    }

    return null;
}

function parseProperties(xml, entityTypeName) {
    const entityRegex = new RegExp(`<EntityType[^>]*Name="${entityTypeName}"[^>]*>([\\s\\S]*?)</EntityType>`);
    const match = xml.match(entityRegex);
    if (!match) return null;

    const content = match[1];
    const properties = [];
    const propRegex = /<Property\s+([^\/>]+)(\/?>)/g;
    let m;
    while ((m = propRegex.exec(content)) !== null) {
        const attrs = m[1];
        const name = (attrs.match(/Name="([^"]+)"/) || [])[1];
        const type = (attrs.match(/Type="([^"]+)"/) || [])[1];
        const nullableStr = (attrs.match(/Nullable="([^"]+)"/) || [])[1];
        const maxLengthStr = (attrs.match(/MaxLength="([^"]+)"/) || [])[1];
        const precisionStr = (attrs.match(/Precision="([^"]+)"/) || [])[1];
        const scaleStr = (attrs.match(/Scale="([^"]+)"/) || [])[1];

        if (!name) continue;

        const prop = {
            name,
            type: type || 'Edm.String',
            nullable: nullableStr !== 'false',
        };
        if (maxLengthStr) prop.maxLength = Number(maxLengthStr);
        if (precisionStr) prop.precision = Number(precisionStr);
        if (scaleStr) prop.scale = Number(scaleStr);
        properties.push(prop);
    }

    // Also extract Key fields
    const keyMatch = content.match(/<Key>([\s\S]*?)<\/Key>/);
    const keyFields = new Set();
    if (keyMatch) {
        const keyRefRegex = /<PropertyRef\s+Name="([^"]+)"\s*\/?>/g;
        let km;
        while ((km = keyRefRegex.exec(keyMatch[1])) !== null) {
            keyFields.add(km[1]);
        }
    }

    for (const prop of properties) {
        prop.isKey = keyFields.has(prop.name);
    }

    return properties;
}

async function getEntitySchema(args, dependencies) {
    const { scenarioKey, entityName, useCache = true } = args;
    const { sapFetch } = dependencies;

    const scenarios = getScenarios();
    const scenario = scenarios.find(s => s.key === scenarioKey);
    if (!scenario) {
        throw makeError(ErrorCodes.SCENARIO_NOT_FOUND, `Unknown scenario: ${scenarioKey}`);
    }
    if (!scenario.urls.length) {
        throw makeError(ErrorCodes.NO_ENDPOINT, 'No SAP endpoint URL configured for this scenario');
    }

    const baseUrl = scenario.urls[0].replace(/\/$/, '');
    const metadataUrl = `${baseUrl}/$metadata?sap-client=100`;

    let xml;
    const cached = metadataCache.get(metadataUrl);
    if (useCache && cached && Date.now() - cached.parsedAt < METADATA_TTL_MS) {
        xml = cached.xml;
    } else {
        const resp = await sapFetch(metadataUrl);
        xml = typeof resp === 'string' ? resp : JSON.stringify(resp);
        metadataCache.set(metadataUrl, { xml, parsedAt: Date.now() });
    }

    const stripped = stripXmlNamespaces(xml);
    const resolvedType = resolveEntityTypeName(stripped, entityName);
    if (!resolvedType) {
        throw makeError(ErrorCodes.NO_ENDPOINT, `EntitySet or EntityType "${entityName}" not found in $metadata`);
    }

    const properties = parseProperties(stripped, resolvedType);
    if (!properties || properties.length === 0) {
        throw makeError(ErrorCodes.NO_ENDPOINT, `No properties found for EntityType "${resolvedType}"`);
    }

    return {
        scenarioKey,
        entityName,
        resolvedEntityType: resolvedType,
        sourceUrl: metadataUrl,
        propertyCount: properties.length,
        properties,
    };
}

module.exports = {
    getEntitySchema,
    stripXmlNamespaces,
    resolveEntityTypeName,
    parseProperties,
};
