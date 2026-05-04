// Test CCI calculation with real audit data
const fs = require('fs');
const path = require('path');

// Copy the CCI calculation function from the extension
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
    // Critical security findings
    'secret_hardcoded': 10,
    'possible_secret': 8,
    'db_raw_in_api': 8,
    
    // High impact code quality issues
    'blocking_call_in_async': 7,
    'cyclomatic_complexity': 6,
    'code_smell_function_length': 5,
    'code_smell_many_params': 4,
    'large_file': 4,
    
    // Medium impact consistency issues
    'db_naming_mismatch': 3,
    'datetime_tz_mismatch': 3,
    'mapping_divergence': 3,
    'id_type_divergence': 3,
    'error_format_divergence': 3,
    'missing_correlation_id': 2,
    'retry_divergence': 2,
    
    // Low impact structural issues
    'pluralization_divergence': 1,
    'import_map': 1,
    'repo_import_graph': 1,
    'import': 0.5, // Very common, low weight
    'from': 0.1,   // Very common, minimal weight
    
    // Default weight for unknown findings
    'default': 2
  };

  // Calculate weighted score
  let totalWeight = 0;
  const findingCounts = {};
  
  for (const finding of findings) {
    const kind = finding.kind || 'unknown';
    findingCounts[kind] = (findingCounts[kind] || 0) + 1;
    const weight = findingWeights[kind] || findingWeights['default'];
    totalWeight += weight;
  }

  // Calculate CDX (Code Defect Index) - findings per KLOC
  const cdx = (findings.length / Math.max(totalLOC / 1000, 0.1));

  // Calculate CCI score (0-100, where 100 is perfect)
  // Base score is 100, deduct points based on weighted findings density
  const findingsDensity = totalWeight / Math.max(totalLOC / 1000, 0.1); // weighted findings per KLOC
  
  let cci = 100;
  
  // Deduct points based on findings density (more balanced approach)
  if (findingsDensity > 0) {
    // Use logarithmic scaling to avoid too harsh penalties
    cci = Math.max(0, 100 - (Math.log(1 + findingsDensity) * 25)); // Logarithmic penalty
  }
  
  // Additional penalty for critical issues (more balanced)
  const criticalFindings = findings.filter(f => 
    ['secret_hardcoded', 'possible_secret', 'db_raw_in_api', 'blocking_call_in_async'].includes(f.kind)
  ).length;
  
  if (criticalFindings > 0) {
    // Cap critical penalty to avoid going to 0 too easily
    const criticalPenalty = Math.min(30, criticalFindings * 2); // Max 30 points penalty for critical issues
    cci = Math.max(10, cci - criticalPenalty); // Minimum CCI of 10 even with many critical issues
  }

  return {
    cci: Math.round(cci * 100) / 100, // Round to 2 decimal places
    cdx: Math.round(cdx * 100) / 100,
    total_weight: totalWeight
  };
}

// Load real audit data
try {
  const auditDir = '.audit';
  const files = fs.readdirSync(auditDir);
  const latestFindings = files.filter(f => f.startsWith('findings_')).sort().pop();
  
  if (!latestFindings) {
    console.log('No findings files found');
    process.exit(1);
  }
  
  console.log(`Loading: ${latestFindings}`);
  const data = JSON.parse(fs.readFileSync(path.join(auditDir, latestFindings), 'utf8'));
  
  console.log('=== Real Audit Data Analysis ===');
  console.log(`Original CCI: ${data.meta.cci} (hardcoded)`);
  console.log(`KLOC: ${data.meta.kiloc}`);
  console.log(`Total findings: ${data.findings.length}`);
  
  // Create mock fileStats from KLOC
  const mockFileStats = [{ nonBlankLines: data.meta.kiloc * 1000 }];
  
  // Calculate real CCI
  const realMetrics = calculateCCI(data.findings, mockFileStats);
  
  console.log('\n=== New CCI Calculation ===');
  console.log(`New CCI: ${realMetrics.cci}`);
  console.log(`New CDX: ${realMetrics.cdx}`);
  console.log(`Total Weight: ${realMetrics.total_weight}`);
  
  // Analyze findings breakdown
  const breakdown = {};
  for (const finding of data.findings) {
    breakdown[finding.kind] = (breakdown[finding.kind] || 0) + 1;
  }
  
  console.log('\n=== Findings Breakdown (Top 10) ===');
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [kind, count] of sorted) {
    console.log(`${kind}: ${count}`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}