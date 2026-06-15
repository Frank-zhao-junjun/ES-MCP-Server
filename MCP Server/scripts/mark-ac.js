/**
 * scripts/mark-ac.js — 根据 probe-results.json 批量更新 user-stories.md 中的 AC checkbox
 * OK → [x], EMPTY → [x] (空数据但连通), ERROR → 保持 [ ]
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, '..', 'probe-results.json');
const storiesPath = path.join(__dirname, '..', '..', 'docs', 'user-stories.md');

if (!fs.existsSync(resultsPath)) {
    console.error('probe-results.json not found. Run probe-all-apis.js first.');
    process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
let content = fs.readFileSync(storiesPath, 'utf8');

let updated = 0;
for (const r of results) {
    if (r.status === 'OK' || r.status === 'EMPTY') {
        // Find the US-API section and mark all [ ] → [x]
        const sectionStart = content.indexOf(`### ${r.us}:`);
        if (sectionStart === -1) continue;
        
        // Find next ### to know section bounds
        const nextSection = content.indexOf('\n### ', sectionStart + 10);
        const sectionEnd = nextSection === -1 ? content.length : nextSection;
        const section = content.substring(sectionStart, sectionEnd);
        
        // Replace [ ] with [x] in this section only
        const updatedSection = section.replace(/^(\s*)- \[ \]/gm, '$1- [x]');
        if (updatedSection !== section) {
            content = content.substring(0, sectionStart) + updatedSection + content.substring(sectionEnd);
            updated++;
            console.log(`  ${r.us}: [${r.status}] → ${(updatedSection.match(/- \[x\]/g) || []).length} AC marked`);
        }
    }
}

fs.writeFileSync(storiesPath, content);
console.log(`\n${updated} sections updated.`);
