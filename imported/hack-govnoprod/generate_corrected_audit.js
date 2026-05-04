// Generate corrected audit file with proper CCI calculation
const fs = require('fs');
const path = require('path');

// Copy the CCI calculation function
function calculateCCI(findings, fileStats) {
  if (!findings || findings.length === 0) {
    return { cci: 100, cdx: 0, total_weight: 0 };
  }

  // Calculate total lines of code
  const totalLOC = fileStats.reduce((sum, file) => sum + (file.nonBlankLines || 0), 0);
  if (totalLOC === 0) {
    return { cci: 100, cdx: 0, total_weight: 0 };
  }

  // Weight different finding types based on severity
  const findingWeights = {
    'secret_hardcoded': 10, 'possible_secret': 8, 'db_raw_in_api': 8,
    'blocking_call_in_async': 7, 'cyclomatic_complexity': 6, 'code_smell_function_length': 5,
    'code_smell_many_params': 4, 'large_file': 4,
    'db_naming_mismatch': 3, 'datetime_tz_mismatch': 3, 'mapping_divergence': 3,
    'id_type_divergence': 3, 'error_format_divergence': 3, 'missing_correlation_id': 2,
    'retry_divergence': 2, 'weak_semantic_type': 2,
    'pluralization_divergence': 1, 'import_map': 1, 'repo_import_graph': 1,
    'import': 0.5, 'from': 0.1, 'default': 2
  };

  let totalWeight = 0;
  for (const finding of findings) {
    const kind = finding.kind || 'unknown';
    const weight = findingWeights[kind] || findingWeights['default'];
    totalWeight += weight;
  }

  const cdx = (findings.length / Math.max(totalLOC / 1000, 0.1));
  const findingsDensity = totalWeight / Math.max(totalLOC / 1000, 0.1);
  
  let cci = 100;
  if (findingsDensity > 0) {
    cci = Math.max(0, 100 - (Math.log(1 + findingsDensity) * 25));
  }
  
  const criticalFindings = findings.filter(f => 
    ['secret_hardcoded', 'possible_secret', 'db_raw_in_api', 'blocking_call_in_async'].includes(f.kind)
  ).length;
  
  if (criticalFindings > 0) {
    const criticalPenalty = Math.min(30, criticalFindings * 2);
    cci = Math.max(10, cci - criticalPenalty);
  }

  return {
    cci: Math.round(cci * 100) / 100,
    cdx: Math.round(cdx * 100) / 100,
    total_weight: totalWeight
  };
}

// Load and correct audit data
try {
  const auditDir = '.audit';
  const files = fs.readdirSync(auditDir);
  const latestFindings = files.filter(f => f.startsWith('findings_')).sort().pop();
  
  if (!latestFindings) {
    console.log('No findings files found');
    process.exit(1);
  }
  
  console.log(`Processing: ${latestFindings}`);
  const data = JSON.parse(fs.readFileSync(path.join(auditDir, latestFindings), 'utf8'));
  
  // Create mock fileStats from KLOC
  const mockFileStats = [{ nonBlankLines: data.meta.kiloc * 1000 }];
  
  // Calculate real CCI
  const realMetrics = calculateCCI(data.findings, mockFileStats);
  
  // Update metadata with correct values
  const correctedData = {
    ...data,
    meta: {
      ...data.meta,
      cci: realMetrics.cci,
      cdx: realMetrics.cdx,
      total_weight: realMetrics.total_weight,
      timestamp: new Date().toISOString() // Update timestamp
    }
  };
  
  // Write corrected file
  const correctedFilename = `findings_${Date.now()}.json`;
  const correctedPath = path.join(auditDir, correctedFilename);
  
  fs.writeFileSync(correctedPath, JSON.stringify(correctedData, null, 2));
  
  console.log(`✅ Created corrected audit file: ${correctedFilename}`);
  console.log(`Old CCI: ${data.meta.cci} → New CCI: ${realMetrics.cci}`);
  console.log(`CDX: ${realMetrics.cdx}`);
  console.log(`Total Weight: ${realMetrics.total_weight}`);
  console.log(`Total Findings: ${data.findings.length}`);
  
} catch (error) {
  console.error('Error:', error.message);
}