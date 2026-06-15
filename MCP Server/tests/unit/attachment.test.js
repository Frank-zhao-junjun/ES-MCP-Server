/**
 * tests/unit/attachment.test.js
 * US-API-028: Attachment 服务单元测试
 */
const assert = require('assert');
const {
    getAttachment,
    validateAttachmentInput,
    buildAttachmentFilter,
    buildAttachmentUrl,
} = require('../../services/attachment');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateAttachmentInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateAttachmentInput({ businessObjectType: 'BUS2012' }).valid, true);
    assert.strictEqual(validateAttachmentInput({ businessObjectKey: '4500000001' }).valid, true);
    assert.strictEqual(validateAttachmentInput({ documentType: 'PDF' }).valid, true);
}

function testValidateRejectsNonStringObjectType() {
    const r = validateAttachmentInput({ businessObjectType: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleKey() {
    const filter = buildAttachmentFilter({ businessObjectKey: '4500000001' });
    assert.strictEqual(filter, "BusinessObjectKey eq '4500000001'");
}

function testBuildFilterMultipleKeys() {
    const filter = buildAttachmentFilter({ businessObjectKey: '4500000001, 4500000002' });
    assert.ok(filter.includes('BusinessObjectKey in ('));
}

function testBuildAttachmentUrl() {
    const url = buildAttachmentUrl("BusinessObjectKey eq '4500000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_CV_ATTACHMENT_SRV'));
}

async function testGetAttachmentSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ BusinessObjectKey: '4500000001', FileName: 'invoice.pdf' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getAttachment(
        { businessObjectKey: '4500000001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.attachments[0].FileName, 'invoice.pdf');
}

async function testGetAttachmentValidationFailure() {
    try {
        await getAttachment({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringObjectType();
    testBuildFilterSingleKey();
    testBuildFilterMultipleKeys();
    testBuildAttachmentUrl();
    await testGetAttachmentSuccess();
    await testGetAttachmentValidationFailure();
    console.log('  ✅ attachment.test.js — all passed');
}

module.exports = { run };
