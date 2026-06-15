/**
 * services/attachment.js
 * SAP Attachment 附件管理查询服务 (OData V2)
 *
 * US-API-028 / SAP_COM_0037
 * Service: API_CV_ATTACHMENT_SRV
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateAttachmentInput(args) {
    const { businessObjectType, businessObjectKey, documentType } = args || {};

    const hasFilter = Boolean(businessObjectType) || Boolean(businessObjectKey)
        || Boolean(documentType);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: businessObjectType, businessObjectKey, or documentType'),
        };
    }

    if (businessObjectType && typeof businessObjectType !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'businessObjectType must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildAttachmentFilter(args) {
    const { businessObjectType, businessObjectKey, documentType } = args || {};
    const conditions = [];

    if (businessObjectType) {
        conditions.push(`BusinessObjectType eq '${businessObjectType}'`);
    }

    if (businessObjectKey) {
        const keys = businessObjectKey.split(',').map(s => s.trim()).filter(Boolean);
        if (keys.length === 1) {
            conditions.push(`BusinessObjectKey eq '${keys[0]}'`);
        } else {
            conditions.push(`BusinessObjectKey in (${keys.map(k => `'${k}'`).join(',')})`);
        }
    }

    if (documentType) {
        conditions.push(`DocumentType eq '${documentType}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildAttachmentUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_CV_ATTACHMENT_SRV/A_Attachment';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询附件列表
 * @param {object} args - { businessObjectType?, businessObjectKey?, documentType?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { attachments, count, filter }
 */
async function getAttachment(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateAttachmentInput(args);
    if (!validation.valid) throw validation.error;

    const { top = DEFAULT_TOP } = args;
    const filter = buildAttachmentFilter(args);
    const url = buildAttachmentUrl(filter, top);

    const data = await sapFetch(url);
    const attachments = extractRows(data);

    return {
        attachments,
        count: attachments.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getAttachment,
    validateAttachmentInput,
    buildAttachmentFilter,
    buildAttachmentUrl,
};
