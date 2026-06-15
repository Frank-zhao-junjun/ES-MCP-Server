/**
 * tests/unit/iam-user-role.test.js
 * US-API-029: IAM User & Role 服务单元测试
 */
const assert = require('assert');
const {
    getIamUserRole,
    validateIamUserRoleInput,
    buildBusinessUserFilter,
    buildBusinessRoleFilter,
    buildPfcgRoleFilter,
    buildBusinessUserUrl,
    buildBusinessRoleUrl,
    buildPfcgRoleUrl,
} = require('../../services/iam-user-role');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateIamUserRoleInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateIamUserRoleInput({ userId: 'ADMIN' }).valid, true);
    assert.strictEqual(validateIamUserRoleInput({ businessRole: 'BR_PURCHASER' }).valid, true);
    assert.strictEqual(validateIamUserRoleInput({ pfcgRole: 'SAP_BR_PURCHASER' }).valid, true);
    assert.strictEqual(validateIamUserRoleInput({ personId: 'P001' }).valid, true);
}

function testValidateRejectsNonStringUserId() {
    const r = validateIamUserRoleInput({ userId: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildBusinessUserFilter() {
    const filter = buildBusinessUserFilter({ userId: 'ADMIN' });
    assert.strictEqual(filter, "UserID eq 'ADMIN'");
}

function testBuildBusinessUserFilterMultiple() {
    const filter = buildBusinessUserFilter({ userId: 'ADMIN, USER1' });
    assert.ok(filter.includes('UserID in ('));
}

function testBuildBusinessRoleFilter() {
    const filter = buildBusinessRoleFilter({ businessRole: 'BR_PURCHASER' });
    assert.strictEqual(filter, "BusinessRole eq 'BR_PURCHASER'");
}

function testBuildPfcgRoleFilter() {
    const filter = buildPfcgRoleFilter({ pfcgRole: 'SAP_BR_PURCHASER' });
    assert.strictEqual(filter, "PFCGRole eq 'SAP_BR_PURCHASER'");
}

function testBuildBusinessUserUrl() {
    const url = buildBusinessUserUrl("UserID eq 'ADMIN'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('APS_IAM_SIAG_SRV'));
}

function testBuildBusinessRoleUrl() {
    const url = buildBusinessRoleUrl("BusinessRole eq 'BR_PURCHASER'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('APS_IAM_BP_SRV'));
}

function testBuildPfcgRoleUrl() {
    const url = buildPfcgRoleUrl("PFCGRole eq 'SAP_BR_PURCHASER'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('APS_IAM_PFCG_SRV'));
}

async function testGetIamUserRoleSuccess() {
    const mockSapFetch = async (url) => {
        if (url.includes('APS_IAM_SIAG_SRV')) {
            return { d: { results: [{ UserID: 'ADMIN', PersonID: 'P001' }] } };
        }
        if (url.includes('APS_IAM_BP_SRV')) {
            return { d: { results: [{ BusinessRole: 'BR_PURCHASER' }] } };
        }
        if (url.includes('APS_IAM_PFCG_SRV')) {
            return { d: { results: [{ PFCGRole: 'SAP_BR_PURCHASER' }] } };
        }
        return { d: { results: [] } };
    };
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getIamUserRole(
        { userId: 'ADMIN', businessRole: 'BR_PURCHASER', pfcgRole: 'SAP_BR_PURCHASER' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.users.length, 1);
    assert.strictEqual(result.businessRoles.length, 1);
    assert.strictEqual(result.pfcgRoles.length, 1);
    assert.strictEqual(result.count, 3);
}

async function testGetIamUserRoleValidationFailure() {
    try {
        await getIamUserRole({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringUserId();
    testBuildBusinessUserFilter();
    testBuildBusinessUserFilterMultiple();
    testBuildBusinessRoleFilter();
    testBuildPfcgRoleFilter();
    testBuildBusinessUserUrl();
    testBuildBusinessRoleUrl();
    testBuildPfcgRoleUrl();
    await testGetIamUserRoleSuccess();
    await testGetIamUserRoleValidationFailure();
    console.log('  ✅ iam-user-role.test.js — all passed');
}

module.exports = { run };
