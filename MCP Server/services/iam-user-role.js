/**
 * services/iam-user-role.js
 * SAP IAM User & Role 用户与角色查询服务 (OData V2)
 *
 * US-API-029 / SAP_COM_0066
 * Services: APS_IAM_SIAG_SRV (Business User), APS_IAM_BP_SRV (Business Role),
 *           APS_IAM_PFCG_SRV (PFCG Role)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateIamUserRoleInput(args) {
    const { userId, businessRole, pfcgRole, personId } = args || {};

    const hasFilter = Boolean(userId) || Boolean(businessRole)
        || Boolean(pfcgRole) || Boolean(personId);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: userId, businessRole, pfcgRole, or personId'),
        };
    }

    if (userId && typeof userId !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'userId must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildBusinessUserFilter(args) {
    const { userId, personId } = args || {};
    const conditions = [];

    if (userId) {
        const users = userId.split(',').map(s => s.trim()).filter(Boolean);
        if (users.length === 1) {
            conditions.push(`UserID eq '${users[0]}'`);
        } else {
            conditions.push(`UserID in (${users.map(u => `'${u}'`).join(',')})`);
        }
    }

    if (personId) {
        conditions.push(`PersonID eq '${personId}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

function buildBusinessRoleFilter(args) {
    const { businessRole } = args || {};
    const conditions = [];

    if (businessRole) {
        const roles = businessRole.split(',').map(s => s.trim()).filter(Boolean);
        if (roles.length === 1) {
            conditions.push(`BusinessRole eq '${roles[0]}'`);
        } else {
            conditions.push(`BusinessRole in (${roles.map(r => `'${r}'`).join(',')})`);
        }
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

function buildPfcgRoleFilter(args) {
    const { pfcgRole } = args || {};
    const conditions = [];

    if (pfcgRole) {
        const roles = pfcgRole.split(',').map(s => s.trim()).filter(Boolean);
        if (roles.length === 1) {
            conditions.push(`PFCGRole eq '${roles[0]}'`);
        } else {
            conditions.push(`PFCGRole in (${roles.map(r => `'${r}'`).join(',')})`);
        }
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildBusinessUserUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/APS_IAM_SIAG_SRV/BusinessUser';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildBusinessRoleUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/APS_IAM_BP_SRV/BusinessRole';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildPfcgRoleUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/APS_IAM_PFCG_SRV/PFCGRole';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询用户与角色
 * @param {object} args - { userId?, businessRole?, pfcgRole?, personId?, includeUsers?, includeBusinessRoles?, includePfcgRoles?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { users, businessRoles, pfcgRoles, count, filter }
 */
async function getIamUserRole(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateIamUserRoleInput(args);
    if (!validation.valid) throw validation.error;

    const {
        includeUsers = true,
        includeBusinessRoles = true,
        includePfcgRoles = true,
        top = DEFAULT_TOP,
    } = args;

    const result = {
        users: [],
        businessRoles: [],
        pfcgRoles: [],
        count: 0,
        filter: '',
    };

    const userFilter = buildBusinessUserFilter(args);
    const roleFilter = buildBusinessRoleFilter(args);
    const pfcgFilter = buildPfcgRoleFilter(args);
    result.filter = userFilter || roleFilter || pfcgFilter || '(none)';

    // Business Users
    if (includeUsers && (args.userId || args.personId)) {
        try {
            const data = await sapFetch(buildBusinessUserUrl(userFilter, top));
            result.users = extractRows(data);
        } catch (_) { result.users = []; }
    }

    // Business Roles
    if (includeBusinessRoles && args.businessRole) {
        try {
            const data = await sapFetch(buildBusinessRoleUrl(roleFilter, top));
            result.businessRoles = extractRows(data);
        } catch (_) { result.businessRoles = []; }
    }

    // PFCG Roles
    if (includePfcgRoles && args.pfcgRole) {
        try {
            const data = await sapFetch(buildPfcgRoleUrl(pfcgFilter, top));
            result.pfcgRoles = extractRows(data);
        } catch (_) { result.pfcgRoles = []; }
    }

    result.count = result.users.length + result.businessRoles.length + result.pfcgRoles.length;
    return result;
}

module.exports = {
    getIamUserRole,
    validateIamUserRoleInput,
    buildBusinessUserFilter,
    buildBusinessRoleFilter,
    buildPfcgRoleFilter,
    buildBusinessUserUrl,
    buildBusinessRoleUrl,
    buildPfcgRoleUrl,
};
