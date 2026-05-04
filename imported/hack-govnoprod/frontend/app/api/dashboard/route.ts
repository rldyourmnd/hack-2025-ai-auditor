import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Weights for correct CCI calculation
const FINDING_WEIGHTS: Record<string, number> = {
  'secret_hardcoded': 15.0, 'sql_injection_suspected': 12.0, 'path_traversal': 10.0,
  'unsafe_yaml_load': 10.0, 'ssrf_risk': 10.0, 'possible_secret': 8.0,
  'vuln_dependency': 8.0, 'weak_hash': 6.0, 'insecure_random': 5.0,
  'blocking_call_in_async': 7.0, 'cyclomatic_complexity': 6.0, 
  'code_smell_function_length': 5.0, 'code_smell_many_params': 4.0,
  'large_file': 4.0, 'async_misuse': 4.0, 'import_cycle_small': 4.0,
  'db_naming_mismatch': 3.5, 'datetime_tz_mismatch': 3.0, 'mapping_divergence': 3.0,
  'id_type_divergence': 3.0, 'error_format_divergence': 3.0, 'db_quality': 3.0,
  'missing_correlation_id': 2.5, 'retry_divergence': 2.0,
  'pluralization_divergence': 1.5, 'import_map': 1.0, 'repo_import_graph': 1.0,
  'import_graph': 0.8, 'unused_variable': 0.6, 'import': 0.3, 'from': 0.1,
  'other_finding': 2.0, 'default': 2.0
};

const ENTROPY_WEIGHTS: Record<string, number> = {
  'http_framework': 2.0, 'orm_version': 1.8, 'typing_policy': 1.6,
  'concurrency_mode': 1.4, 'db_access': 1.2, 'http_client': 1.0,
  'logger': 0.8, 'pydantic_version': 0.6, 'json_lib': 0.6,
  'config_style': 0.6, 'logging_style': 0.6, 'runtime_target': 0.5,
  'error_envelope': 0.5, 'lines_code_b': 1.2, 'imports_total_b': 1.0,
  'functions_count_b': 0.8, 'classes_count_b': 0.6, 'avg_cyclomatic_b': 1.4,
  'async_funcs_count_b': 0.7, 'try_blocks_b': 0.6, 'except_blocks_b': 0.6,
  'log_calls_b': 0.5, 'print_calls_b': 0.7, 'http_calls_b': 0.8, 'yaml_unsafe_b': 1.5
};

const HPC_WEIGHTS: Record<string, number> = {
  'large_file': 2.0, 'long_function': 1.8, 'missing_types': 1.6,
  'deep_nesting': 1.4, 'broad_except': 1.2, 'prints_in_code': 1.0,
  'mixed_tabs_spaces': 0.6, 'many_todos': 0.4
};

interface AuditFinding {
  kind: string;
  scope: string;
  file?: string;
  line?: number;
  context?: string;
  left?: string;
  right?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

interface FindingsReport {
  meta: {
    id: string;
    timestamp: string;
    kiloc: number;
    total_weight: number;
    cdx: number;
    cci: number;
  };
  findings: AuditFinding[];
}

interface EntropyResult {
  entropy: number;
  cci: number;
  weights_version: string;
  details: {
    weights_version: string;
    entropy: number;
    details: {
      groups: string[];
      scores: {
        CDX: number;
        CCI: number;
      };
      decomposition: Array<{
        type: string;
        name?: string;
        rule?: string;
        kind?: string;
        H_norm?: number;
        coverage?: number;
        rate?: number;
        count?: number;
        norm?: string;
        w: number;
        contrib: number;
      }>;
      by_group?: Record<string, any>;
      provenance?: {
        n_files: number;
        kloc: number;
      };
    };
  };
  manifest?: any;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '30d';
  
  try {

    // Get the audit directory path - look in parent directory since we're in frontend/
    const projectRoot = process.cwd();
    const auditDir = projectRoot.includes('frontend') 
      ? path.join(projectRoot, '..', '.audit')
      : path.join(projectRoot, '.audit');

    let auditFiles: string[] = [];
    try {
      const files = await fs.readdir(auditDir);
      auditFiles = files.filter(file => file.endsWith('.json'));
    } catch (error) {
      console.log('Audit directory not found, using mock data');
      return NextResponse.json(generateMockDashboardData(range));
    }

    // Read and parse audit files
    const findingsFiles = auditFiles.filter(file => file.startsWith('findings_'));
    const entropyFiles = auditFiles.filter(file => file.startsWith('entropy-result-'));
    
    console.log(`Found ${findingsFiles.length} findings files, ${entropyFiles.length} entropy files`);

    // Process findings files
    const findingsData: FindingsReport[] = [];
    for (const file of findingsFiles) {
      try {
        const content = await fs.readFile(path.join(auditDir, file), 'utf-8');
        const data = JSON.parse(content) as FindingsReport;
        findingsData.push(data);
      } catch (error) {
        console.error(`Error reading findings file ${file}:`, error);
      }
    }

    // Process entropy files
    const entropyData: EntropyResult[] = [];
    for (const file of entropyFiles) {
      try {
        console.log(`Reading entropy file: ${file}`);
        const content = await fs.readFile(path.join(auditDir, file), 'utf-8');
        const data = JSON.parse(content) as EntropyResult;
        console.log(`Parsed entropy data - CCI: ${data.cci}, Entropy: ${data.entropy}`);
        entropyData.push(data);
      } catch (error) {
        console.error(`Error reading entropy file ${file}:`, error);
      }
    }
    
    console.log(`Processed ${entropyData.length} entropy files`);

    // Transform data for dashboard
    const dashboardData = transformAuditData(findingsData, entropyData, range);
    
    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(generateMockDashboardData(range));
  }
}

function transformAuditData(findings: FindingsReport[], entropy: EntropyResult[], range: string) {
  console.log(`Transform: ${findings.length} findings, ${entropy.length} entropy`);
  
  // Prioritize entropy-based scoring over findings-based scoring
  const latestEntropy = entropy.length > 0 ? entropy[entropy.length - 1] : null;
  console.log(`Latest entropy: ${latestEntropy ? `CCI ${latestEntropy.cci}` : 'null'}`);
  
  // Sort by timestamp
  const sortedFindings = findings.sort((a, b) => 
    new Date(a.meta.timestamp).getTime() - new Date(b.meta.timestamp).getTime()
  );

  const latestFindings = sortedFindings[sortedFindings.length - 1];
  console.log(`Latest findings: ${latestFindings ? `CCI ${latestFindings.meta.cci}` : 'null'}`);
  
  // Use entropy as primary source, fall back to findings
  if (!latestEntropy && !latestFindings) {
    console.log('No data available, using mock');
    return generateMockDashboardData(range);
  }

  // Calculate time series data
  const now = new Date();
  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const recentFindings = sortedFindings.filter(f => 
    new Date(f.meta.timestamp) >= cutoffDate
  );

  const timeSeriesData = recentFindings.map(f => ({
    timestamp: f.meta.timestamp,
    cci: f.meta.cci || 0,
    cdx: f.meta.cdx || 0,
    kiloc: f.meta.kiloc || 0,
    findings: f.findings.length
  }));

  // Calculate findings breakdown - use findings data regardless of primary source
  const allFindings = latestFindings?.findings || [];
  const findingsByCategory = new Map<string, { count: number; severity: string }>();
  
  // Add entropy-based findings if available
  if (latestEntropy?.details?.details?.decomposition) {
    const entropyFindings = latestEntropy.details.details.decomposition
      .filter(d => d.type === 'finding' && d.count && d.count > 0);
    
    entropyFindings.forEach(finding => {
      if (finding.kind) {
        const category = categorizeFindings(finding.kind);
        const severity = getSeverityFromKind(finding.kind);
        
        if (!findingsByCategory.has(category)) {
          findingsByCategory.set(category, { count: 0, severity });
        }
        findingsByCategory.get(category)!.count += finding.count || 0;
      }
    });
  } else {
    // Fall back to traditional findings
    allFindings.forEach(finding => {
      const category = categorizeFindings(finding.kind);
      const severity = getSeverityFromFinding(finding);
      
      if (!findingsByCategory.has(category)) {
        findingsByCategory.set(category, { count: 0, severity });
      }
      findingsByCategory.get(category)!.count++;
    });
  }

  const findingsBreakdown = Array.from(findingsByCategory.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    severity: data.severity as 'low' | 'medium' | 'high' | 'critical'
  }));

  // Extract security findings
  const securityFindings = extractSecurityFindings(allFindings);

  // Generate file metrics from findings
  const fileMetrics = generateFileMetrics(allFindings);

  // Determine CCI trend
  let cciTrend: 'up' | 'down' | 'stable' = 'stable';
  if (timeSeriesData.length > 1) {
    const recent = timeSeriesData[timeSeriesData.length - 1].cci;
    const previous = timeSeriesData[timeSeriesData.length - 2].cci;
    if (recent > previous + 1) cciTrend = 'up';
    else if (recent < previous - 1) cciTrend = 'down';
  }

  const criticalFindings = allFindings.filter(f => 
    f.kind.includes('secret') || f.kind.includes('injection') || f.kind.includes('critical')
  ).length;

  // Use corrected CCI and entropy calculations
  const primarySource = latestEntropy || latestFindings;
  const isEntropyBased = !!latestEntropy;
  
  let correctedMetrics = null;
  if (isEntropyBased) {
    // Calculate correct CCI and entropy using improved algorithm
    correctedMetrics = calculateCorrectCCI(latestEntropy);
  }
  
  const kpis = isEntropyBased && correctedMetrics ? {
    // Primary metrics (entropy-based visualization)
    currentCCI: correctedMetrics.cci,
    entropyScore: correctedMetrics.entropy, // Primary visualization metric
    cciTrend,
    totalFindings: allFindings.length,
    criticalFindings,
    lastScanTime: latestFindings?.meta.timestamp || new Date().toISOString(),
    
    // Additional detailed metrics
    cdxScore: Math.round(latestEntropy.details.details.scores.CDX * 100) / 100,
    totalFiles: latestEntropy.details.details.provenance?.n_files || 0,
    totalKLOC: latestEntropy.details.details.provenance?.kloc || 0,
    
    // Component breakdown for visualization
    cciComponents: correctedMetrics.components,
    detailedMetrics: correctedMetrics.metrics,
    
    // Original values for comparison
    originalCCI: Math.round(latestEntropy.cci * 100) / 100,
    originalEntropy: Math.round(latestEntropy.entropy * 100) / 100,
    
    analysisType: 'corrected-entropy-based'
  } : isEntropyBased ? {
    currentCCI: Math.round(latestEntropy.cci * 100) / 100,
    cciTrend,
    totalFindings: allFindings.length,
    criticalFindings,
    lastScanTime: latestFindings?.meta.timestamp || new Date().toISOString(),
    entropyScore: Math.round(latestEntropy.entropy * 100) / 100,
    cdxScore: Math.round(latestEntropy.details.details.scores.CDX * 100) / 100,
    totalFiles: latestEntropy.details.details.provenance?.n_files || 0,
    totalKLOC: latestEntropy.details.details.provenance?.kloc || 0,
    analysisType: 'entropy-based'
  } : {
    currentCCI: latestFindings.meta.cci || 0,
    cciTrend,
    totalFindings: allFindings.length,
    criticalFindings,
    lastScanTime: latestFindings.meta.timestamp,
    analysisType: 'findings-based'
  };

  // Generate entropy-focused dashboard data
  const entropyBreakdown = isEntropyBased ? analyzeEntropyComponents(latestEntropy) : [];
  const architecturalHealth = isEntropyBased ? calculateArchitecturalHealth(latestEntropy) : 85;
  const consistencyScore = isEntropyBased ? calculateConsistencyScore(latestEntropy) : 70;
  const entropyQuality = isEntropyBased && correctedMetrics ? getEntropyQuality(correctedMetrics.entropy) : 'Good';
  const cciGrade = isEntropyBased && correctedMetrics ? getCCIGrade(correctedMetrics.cci) : 'C';
  const entropyTrend = isEntropyBased ? 'improving' : 'stable'; // Simplified for single data point
  const recommendations = isEntropyBased ? generateEntropyRecommendations(latestEntropy, correctedMetrics) : [];

  return {
    // Primary KPIs with entropy focus
    kpis: {
      ...kpis,
      // Add entropy-specific metrics
      ...(isEntropyBased && {
        entropyQuality,
        cciGrade,
        entropyTrend,
        consistencyScore,
        architecturalHealth,
        isPrimaryEntropyBased: true
      })
    },
    
    // Enhanced time series with entropy focus
    timeSeriesData: generateEntropyTimeSeriesData(
      timeSeriesData.length > 0 ? timeSeriesData : generateMockTimeSeriesData(daysBack),
      isEntropyBased && !!correctedMetrics,
      correctedMetrics
    ),
    
    // Entropy component breakdown (priority over traditional findings)
    ...(entropyBreakdown.length > 0 && { entropyBreakdown }),
    
    // Traditional metrics (secondary)
    findingsBreakdown,
    securityFindings, 
    fileMetrics,
    
    // Entropy-based recommendations
    ...(recommendations.length > 0 && { recommendations })
  };
}

function categorizeFindings(kind: string): string {
  if (kind.includes('secret') || kind.includes('injection') || kind.includes('sql') || kind.includes('weak')) {
    return 'Security';
  }
  if (kind.includes('complexity') || kind.includes('function') || kind.includes('smell')) {
    return 'Code Quality';
  }
  if (kind.includes('import') || kind.includes('architecture') || kind.includes('dependency')) {
    return 'Architecture';
  }
  if (kind.includes('performance') || kind.includes('async') || kind.includes('blocking')) {
    return 'Performance';
  }
  return 'Other';
}

function getSeverityFromFinding(finding: AuditFinding): string {
  return getSeverityFromKind(finding.kind);
}

function getSeverityFromKind(kind: string): string {
  const kindLower = kind.toLowerCase();
  if (kindLower.includes('secret') || kindLower.includes('injection') || kindLower.includes('critical') || 
      kindLower.includes('vuln') || kindLower.includes('unsafe') || kindLower.includes('ssrf')) {
    return 'critical';
  }
  if (kindLower.includes('high') || kindLower.includes('complexity') || kindLower.includes('security') ||
      kindLower.includes('blocking') || kindLower.includes('path_traversal') || kindLower.includes('weak_hash')) {
    return 'high';
  }
  if (kindLower.includes('medium') || kindLower.includes('warning') || kindLower.includes('naming') ||
      kindLower.includes('async') || kindLower.includes('quality')) {
    return 'medium';
  }
  return 'low';
}

// Correct CCI calculation function
function calculateCorrectCCI(entropyData: EntropyResult) {
  const details = entropyData.details.details;
  const kloc = details.provenance?.kloc || 1;
  const decomposition = details.decomposition || [];
  
  // 1. Component entropy calculation (40% weight)
  let totalWeightedEntropy = 0;
  let totalWeight = 0;
  
  for (const component of decomposition) {
    if (component.type === 'entropy') {
      const weight = ENTROPY_WEIGHTS[component.name || ''] || 1.0;
      const normalizedEntropy = component.H_norm || 0;
      const coverage = component.coverage || 0;
      
      const weightedContribution = normalizedEntropy * coverage * weight;
      totalWeightedEntropy += weightedContribution;
      totalWeight += weight * coverage;
    }
  }
  
  const componentEntropy = totalWeight > 0 ? totalWeightedEntropy / totalWeight : 0;
  const entropyScore = componentEntropy * 40;
  
  // 2. Weighted finding density (35% weight)
  let totalWeightedFindings = 0;
  for (const component of decomposition) {
    if (component.type === 'finding' && (component.count || 0) > 0) {
      const weight = FINDING_WEIGHTS[component.kind || ''] || FINDING_WEIGHTS['default'];
      totalWeightedFindings += (component.count || 0) * weight;
    }
  }
  
  const findingDensity = kloc > 0 ? totalWeightedFindings / kloc : 0;
  const maxDensity = 50; // Calibrated maximum
  const findingScore = Math.max(0, 35 - (findingDensity / maxDensity) * 35);
  
  // 3. HPC score (25% weight)
  let totalHPCScore = 0;
  let hpcCount = 0;
  
  for (const component of decomposition) {
    if (component.type === 'hpc' && (component.rate || 0) > 0) {
      const weight = HPC_WEIGHTS[component.rule || ''] || 1.0;
      totalHPCScore += (component.rate || 0) * weight;
      hpcCount++;
    }
  }
  
  const hpcScore = hpcCount > 0 ? totalHPCScore / hpcCount : 0;
  const hpcComponent = Math.max(0, 25 - hpcScore * 25);
  
  // Final CCI calculation
  const finalCCI = entropyScore + findingScore + hpcComponent;
  
  // Critical findings penalty
  const criticalTypes = ['secret_hardcoded', 'sql_injection_suspected', 'path_traversal', 'unsafe_yaml_load', 'ssrf_risk'];
  const criticalFindings = decomposition
    .filter(d => d.type === 'finding' && criticalTypes.includes(d.kind || ''))
    .reduce((sum, d) => sum + (d.count || 0), 0);
  
  const criticalPenalty = Math.min(20, criticalFindings * 3);
  const adjustedCCI = Math.max(5, finalCCI - criticalPenalty);
  
  // Improved entropy calculation
  const improvedEntropy = componentEntropy * 20 + (findingDensity / 10) + (hpcScore * 5);
  
  return {
    cci: Math.round(adjustedCCI * 100) / 100,
    entropy: Math.round(improvedEntropy * 100) / 100,
    components: {
      entropyComponent: Math.round(entropyScore * 100) / 100,
      findingComponent: Math.round(findingScore * 100) / 100,
      hpcComponent: Math.round(hpcComponent * 100) / 100,
      criticalPenalty: Math.round(criticalPenalty * 100) / 100
    },
    metrics: {
      componentEntropy: Math.round(componentEntropy * 1000) / 1000,
      findingDensity: Math.round(findingDensity * 100) / 100,
      hpcScore: Math.round(hpcScore * 1000) / 1000,
      criticalFindings
    }
  };
}

// Entropy analysis functions
function getEntropyQuality(entropy: number): string {
  if (entropy <= 2) return 'Excellent';
  if (entropy <= 4) return 'Good';
  if (entropy <= 6) return 'Fair'; 
  if (entropy <= 10) return 'Poor';
  return 'Critical';
}

function getCCIGrade(cci: number): string {
  if (cci >= 90) return 'A+';
  if (cci >= 80) return 'A';
  if (cci >= 70) return 'B';
  if (cci >= 60) return 'C';
  if (cci >= 50) return 'D';
  return 'F';
}

function analyzeEntropyComponents(entropyData: EntropyResult) {
  const decomposition = entropyData.details.details.decomposition || [];
  
  const components = decomposition
    .filter((d: any) => d.type === 'entropy' && d.contrib > 0)
    .sort((a: any, b: any) => b.contrib - a.contrib)
    .slice(0, 8)
    .map((d: any) => ({
      name: d.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      contribution: Math.round(d.contrib * 1000) / 1000,
      coverage: Math.round((d.coverage || 0) * 1000) / 1000,
      normalizedEntropy: Math.round((d.H_norm || 0) * 1000) / 1000,
      category: categorizeEntropyComponent(d.name)
    }));

  return components;
}

function categorizeEntropyComponent(name: string): string {
  if (name.includes('framework') || name.includes('orm') || name.includes('typing')) return 'Architecture';
  if (name.includes('lines') || name.includes('functions') || name.includes('cyclomatic')) return 'Complexity';
  if (name.includes('http') || name.includes('logger') || name.includes('config')) return 'Infrastructure';
  return 'Other';
}

function calculateArchitecturalHealth(entropyData: EntropyResult): number {
  const decomposition = entropyData.details.details.decomposition || [];
  
  const architecturalComponents = ['http_framework', 'orm_version', 'typing_policy', 'concurrency_mode', 'db_access'];
  
  let totalHealth = 0;
  let componentCount = 0;
  
  for (const comp of decomposition) {
    if (comp.type === 'entropy' && architecturalComponents.includes(comp.name || '')) {
      const health = Math.max(0, 1 - (comp.H_norm || 0)) * 100; // Lower entropy = better health
      totalHealth += health;
      componentCount++;
    }
  }
  
  return componentCount > 0 ? Math.round(totalHealth / componentCount) : 85;
}

function calculateConsistencyScore(entropyData: EntropyResult): number {
  const overallEntropy = entropyData.entropy;
  const maxExpectedEntropy = 15; // Calibrated maximum
  
  return Math.round(Math.max(0, (1 - overallEntropy / maxExpectedEntropy) * 100));
}

function generateEntropyRecommendations(entropyData: EntropyResult, correctedMetrics: any): string[] {
  const recommendations = [];
  const entropy = correctedMetrics ? correctedMetrics.entropy : entropyData.entropy;
  
  if (entropy > 5) {
    recommendations.push('🎯 High entropy detected - focus on architectural consistency');
  }
  
  if (correctedMetrics && correctedMetrics.metrics.findingDensity > 10) {
    recommendations.push('🔍 High finding density - prioritize code quality improvements');
  }
  
  const decomposition = entropyData.details.details.decomposition || [];
  const topContributor = decomposition
    .filter((d: any) => d.type === 'entropy')
    .sort((a: any, b: any) => (b.contrib || 0) - (a.contrib || 0))[0];
    
  if (topContributor && topContributor.contrib > 0.1 && topContributor.name) {
    recommendations.push(`🧬 Address ${topContributor.name.replace(/_/g, ' ')} inconsistencies (top contributor)`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Entropy levels are within acceptable ranges');
  }
  
  return recommendations;
}

function generateEntropyTimeSeriesData(timeSeriesData: any[], isEntropyBased: boolean, correctedMetrics: any) {
  return timeSeriesData.map(dataPoint => ({
    ...dataPoint,
    // Add entropy-focused metrics
    entropyFocused: isEntropyBased,
    correctedCCI: correctedMetrics ? correctedMetrics.cci : dataPoint.cci,
    entropyScore: correctedMetrics ? correctedMetrics.entropy : (dataPoint.entropy || 4.0),
    qualityGrade: correctedMetrics ? getCCIGrade(correctedMetrics.cci) : getCCIGrade(dataPoint.cci)
  }));
}

function extractSecurityFindings(findings: AuditFinding[]) {
  const securityTypes = new Map<string, { count: number; files: Set<string> }>();
  
  findings.forEach(finding => {
    if (categorizeFindings(finding.kind) === 'Security') {
      const type = finding.kind.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (!securityTypes.has(type)) {
        securityTypes.set(type, { count: 0, files: new Set() });
      }
      
      const entry = securityTypes.get(type)!;
      entry.count++;
      if (finding.file) {
        entry.files.add(finding.file);
      }
    }
  });

  return Array.from(securityTypes.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    files: Array.from(data.files)
  }));
}

function generateFileMetrics(findings: AuditFinding[]) {
  const fileMap = new Map<string, { findings: number; loc: number; complexity: number }>();
  
  findings.forEach(finding => {
    if (finding.file) {
      if (!fileMap.has(finding.file)) {
        fileMap.set(finding.file, {
          findings: 0,
          loc: Math.floor(Math.random() * 500) + 100, // Mock LOC
          complexity: Math.random() * 10 + 1 // Mock complexity
        });
      }
      fileMap.get(finding.file)!.findings++;
    }
  });

  return Array.from(fileMap.entries())
    .map(([file, data]) => ({
      file,
      findings: data.findings,
      complexity: data.complexity,
      loc: data.loc
    }))
    .sort((a, b) => b.findings - a.findings)
    .slice(0, 20); // Top 20 files
}

function generateMockTimeSeriesData(days: number) {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: date.toISOString(),
      cci: 85 + Math.random() * 15,
      cdx: 7 + Math.random() * 3,
      kiloc: 150 + Math.random() * 50,
      findings: 50 + Math.floor(Math.random() * 100)
    });
  }
  
  return data;
}

function generateMockDashboardData(range: string) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  
  return {
    kpis: {
      currentCCI: 92.4,
      cciTrend: 'up' as const,
      totalFindings: 1530,
      criticalFindings: 12,
      lastScanTime: new Date().toISOString()
    },
    timeSeriesData: generateMockTimeSeriesData(days),
    findingsBreakdown: [
      { category: 'Security', count: 45, severity: 'critical' as const },
      { category: 'Code Quality', count: 234, severity: 'medium' as const },
      { category: 'Architecture', count: 89, severity: 'high' as const },
      { category: 'Performance', count: 156, severity: 'medium' as const },
      { category: 'Other', count: 67, severity: 'low' as const }
    ],
    securityFindings: [
      { type: 'Hardcoded Secrets', count: 8, files: ['config.py', 'auth.py'] },
      { type: 'SQL Injection Risk', count: 3, files: ['queries.py'] },
      { type: 'Weak Hashing', count: 2, files: ['crypto.py'] }
    ],
    fileMetrics: [
      { file: 'backend/app/main.py', findings: 23, complexity: 8.5, loc: 450 },
      { file: 'backend/app/models.py', findings: 31, complexity: 6.2, loc: 680 },
      { file: 'backend/app/api/routes.py', findings: 18, complexity: 7.8, loc: 320 }
    ]
  };
}