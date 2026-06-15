/**
 * services/material-reservation.js
 * SAP Material Reservation 物料预留查询服务 (OData V4)
 *
 * US-API-024 / SAP_COM_0112
 * Service: api_reservation_document
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateReservationInput(args) {
    const { reservation, material, plant, requirementNumber } = args || {};

    const hasFilter = Boolean(reservation) || Boolean(material)
        || Boolean(plant) || Boolean(requirementNumber);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: reservation, material, plant, or requirementNumber'),
        };
    }

    if (reservation && typeof reservation !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'reservation must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildReservationFilter(args) {
    const { reservation, material, plant, requirementNumber } = args || {};
    const conditions = [];

    if (reservation) {
        const resvs = reservation.split(',').map(s => s.trim()).filter(Boolean);
        if (resvs.length === 1) {
            conditions.push(`Reservation eq '${resvs[0]}'`);
        } else {
            conditions.push(`Reservation in (${resvs.map(r => `'${r}'`).join(',')})`);
        }
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    if (plant) {
        conditions.push(`Plant eq '${plant}'`);
    }

    if (requirementNumber) {
        conditions.push(`RequirementNumber eq '${requirementNumber}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildReservationUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_reservation_document/srvd_a2x/sap/apireservationdocument/0001/A_ReservationDocument';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildReservationItemsUrl(reservation, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`Reservation eq '${reservation}'`);
    return `/sap/opu/odata4/sap/api_reservation_document/srvd_a2x/sap/apireservationdocument/0001/A_ReservationDocumentItem?$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询物料预留
 * @param {object} args - { reservation?, material?, plant?, requirementNumber?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { reservations, count, filter }
 */
async function getMaterialReservation(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateReservationInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildReservationFilter(args);
    const url = buildReservationUrl(filter, top);

    const data = await sapFetch(url);
    const reservations = extractRows(data);

    if (includeItems && reservations.length > 0) {
        for (const res of reservations) {
            try {
                const itemData = await sapFetch(buildReservationItemsUrl(res.Reservation, top));
                res.items = extractRows(itemData);
            } catch (_) { res.items = []; }
        }
    }

    return {
        reservations,
        count: reservations.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getMaterialReservation,
    validateReservationInput,
    buildReservationFilter,
    buildReservationUrl,
    buildReservationItemsUrl,
};
