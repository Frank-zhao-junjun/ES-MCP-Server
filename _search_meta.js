const fs = require('fs');
['SalesOrder_metadata.xml', 'SalesOrder_V2_metadata.xml'].forEach(f => {
    try {
        const c = fs.readFileSync(f, 'utf8');
        const keywords = ['SpecialStock', 'MRPType', 'MTO', 'MaterialStk', 
                         'RequirementSeg', 'StockSeg', 'OrderStrategy', 'Alloc', 'StrategyGrp'];
        keywords.forEach(k => {
            const idx = c.indexOf(k);
            if (idx >= 0) {
                console.log(f + ': found "' + k + '" at pos ' + idx);
                console.log('  context: ' + c.substring(Math.max(0, idx-60), idx+80));
            }
        });
        // Also check if no matches
        const allFound = keywords.filter(k => c.indexOf(k) >= 0);
        if (allFound.length === 0) {
            console.log(f + ': NONE of the keywords found in metadata');
        }
    } catch(e) {
        console.log(f + ': ' + e.message);
    }
});
