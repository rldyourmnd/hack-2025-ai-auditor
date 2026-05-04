import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Entropy-focused dashboard API endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '30d';
  
  try {
    // Get audit directory  
    const projectRoot = process.cwd();
    const auditDir = projectRoot.includes('frontend') 
      ? path.join(projectRoot, '..', '.audit')
      : path.join(projectRoot, '.audit');

    let auditFiles: string[] = [];
    try {
      const files = await fs.readdir(auditDir);
      auditFiles = files.filter(file => file.endsWith('.json'));
    } catch (error) {
      console.log('Audit directory not found, returning entropy-focused mock');
      return NextResponse.json(generateEntropyMockData(range));
    }

    // Load corrected CCI analysis if available
    const correctedAnalysisFile = path.join(auditDir, 'correct-cci-entropy-analysis.json');
    let correctedData = null;
    
    try {
      const content = await fs.readFile(correctedAnalysisFile, 'utf-8');
      correctedData = JSON.parse(content);
    } catch (error) {
      console.log('No corrected analysis file found');
    }

    // Read entropy files
    const entropyFiles = auditFiles.filter(file => file.startsWith('entropy-result-'));
    const findingsFiles = auditFiles.filter(file => file.startsWith('findings_'));

    const entropyData = [];
    for (const file of entropyFiles) {
      try {
        const content = await fs.readFile(path.join(auditDir, file), 'utf-8');
        const data = JSON.parse(content);
        entropyData.push(data);
      } catch (error) {
        console.error(`Error reading entropy file ${file}:`, error);
      }
    }

    const findingsData = [];
    for (const file of findingsFiles) {
      try {
        const content = await fs.readFile(path.join(auditDir, file), 'utf-8');
        const data = JSON.parse(content);
        findingsData.push(data);
      } catch (error) {
        console.error(`Error reading findings file ${file}:`, error);
      }
    }

    // Generate entropy-focused dashboard
    const dashboardData = generateEntropyDashboard(entropyData, findingsData, correctedData, range);
    
    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Entropy dashboard API error:', error);
    return NextResponse.json(generateEntropyMockData(range));
  }
}

function generateEntropyDashboard(entropyData: any[], findingsData: any[], correctedData: any, range: string) {
  const latest = entropyData.length > 0 ? entropyData[entropyData.length - 1] : null;
  const latestFindings = findingsData.length > 0 ? findingsData[findingsData.length - 1] : null;
  
  if (!latest) {
    return generateEntropyMockData(range);
  }

  // Use corrected metrics if available
  let correctedMetrics = null;
  if (correctedData && correctedData.results && correctedData.results.length > 0) {
    correctedMetrics = correctedData.results[correctedData.results.length - 1].corrected;
  }

  // Primary entropy-based metrics
  const primaryEntropy = correctedMetrics ? correctedMetrics.entropy : latest.entropy;
  const primaryCCI = correctedMetrics ? correctedMetrics.cci : latest.cci;
  
  // Entropy quality assessment
  const entropyQuality = getEntropyQuality(primaryEntropy);
  const cciGrade = getCCIGrade(primaryCCI);

  // Entropy trend analysis
  const entropyTrend = analyzeEntropyTrend(entropyData, correctedData);

  // Component breakdown for entropy visualization
  const entropyBreakdown = analyzeEntropyComponents(latest);
  const architecturalHealth = calculateArchitecturalHealth(latest);
  const consistencyScore = calculateConsistencyScore(latest);

  return {
    // Primary entropy-focused KPIs
    entropyMetrics: {
      primaryEntropy,
      entropyQuality,
      entropyTrend,
      consistencyScore,
      architecturalHealth
    },
    
    // CCI as supporting metric
    cciMetrics: {
      currentCCI: primaryCCI,
      cciGrade,
      originalCCI: latest.cci,
      improvement: correctedMetrics ? Math.round((latest.cci - primaryCCI) * 100) / 100 : 0
    },

    // Entropy component analysis
    entropyBreakdown,
    
    // Technical details
    technicalMetrics: {
      totalFiles: latest.details.details.provenance?.n_files || 0,
      kloc: latest.details.details.provenance?.kloc || 0,
      analysisTimestamp: latestFindings?.meta.timestamp || new Date().toISOString(),
      algorithmVersion: correctedData ? correctedData.algorithm : 'original'
    },

    // Corrected components if available
    ...(correctedMetrics && {
      detailedComponents: correctedMetrics.components,
      detailedMetrics: correctedMetrics.metrics
    }),

    // Time series focused on entropy
    entropyTimeSeries: generateEntropyTimeSeries(entropyData, correctedData, range),
    
    // Recommendations based on entropy analysis
    recommendations: generateEntropyRecommendations(latest, correctedMetrics)
  };
}

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

function analyzeEntropyTrend(entropyData: any[], correctedData: any): string {
  if (entropyData.length < 2) return 'stable';
  
  // Use corrected data if available, otherwise original
  const values = correctedData && correctedData.results 
    ? correctedData.results.map((r: any) => r.corrected.entropy)
    : entropyData.map(d => d.entropy);
    
  if (values.length < 2) return 'stable';
  
  const recent = values[values.length - 1];
  const previous = values[values.length - 2];
  const diff = recent - previous;
  
  if (Math.abs(diff) < 0.1) return 'stable';
  return diff < 0 ? 'improving' : 'degrading'; // Lower entropy is better
}

function analyzeEntropyComponents(entropyData: any) {
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

function calculateArchitecturalHealth(entropyData: any): number {
  const decomposition = entropyData.details.details.decomposition || [];
  
  const architecturalComponents = ['http_framework', 'orm_version', 'typing_policy', 'concurrency_mode', 'db_access'];
  
  let totalHealth = 0;
  let componentCount = 0;
  
  for (const comp of decomposition) {
    if (comp.type === 'entropy' && architecturalComponents.includes(comp.name)) {
      const health = Math.max(0, 1 - (comp.H_norm || 0)) * 100; // Lower entropy = better health
      totalHealth += health;
      componentCount++;
    }
  }
  
  return componentCount > 0 ? Math.round(totalHealth / componentCount) : 85;
}

function calculateConsistencyScore(entropyData: any): number {
  const overallEntropy = entropyData.entropy;
  const maxExpectedEntropy = 15; // Calibrated maximum
  
  return Math.round(Math.max(0, (1 - overallEntropy / maxExpectedEntropy) * 100));
}

function generateEntropyTimeSeries(entropyData: any[], correctedData: any, range: string) {
  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  
  if (entropyData.length === 0) {
    return generateMockEntropyTimeSeries(daysBack);
  }

  // Generate time series with focus on entropy metrics
  return entropyData.map((data, index) => {
    const corrected = correctedData && correctedData.results && correctedData.results[index] 
      ? correctedData.results[index].corrected 
      : null;
    
    return {
      timestamp: new Date(Date.now() - (entropyData.length - index - 1) * 24 * 60 * 60 * 1000).toISOString(),
      entropy: corrected ? corrected.entropy : data.entropy,
      cci: corrected ? corrected.cci : data.cci,
      originalEntropy: data.entropy,
      originalCCI: data.cci,
      kloc: data.details.details.provenance?.kloc || 0,
      files: data.details.details.provenance?.n_files || 0
    };
  });
}

function generateEntropyRecommendations(entropyData: any, correctedMetrics: any): string[] {
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
    
  if (topContributor && topContributor.contrib > 0.1) {
    recommendations.push(`🧬 Address ${topContributor.name.replace(/_/g, ' ')} inconsistencies (top contributor)`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Entropy levels are within acceptable ranges');
  }
  
  return recommendations;
}

function generateMockEntropyTimeSeries(days: number) {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: date.toISOString(),
      entropy: 3 + Math.random() * 4, // 3-7 range
      cci: 55 + Math.random() * 30,   // 55-85 range
      originalEntropy: 4 + Math.random() * 8,
      originalCCI: 85 + Math.random() * 15,
      kloc: 70 + Math.random() * 20,
      files: 120 + Math.floor(Math.random() * 40)
    });
  }
  
  return data;
}

function generateEntropyMockData(range: string) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  
  return {
    entropyMetrics: {
      primaryEntropy: 4.2,
      entropyQuality: 'Good',
      entropyTrend: 'stable',
      consistencyScore: 72,
      architecturalHealth: 78
    },
    cciMetrics: {
      currentCCI: 62.5,
      cciGrade: 'C',
      originalCCI: 87.4,
      improvement: 24.9
    },
    entropyBreakdown: [
      { name: 'Lines Code B', contribution: 0.214, coverage: 0.271, normalizedEntropy: 0.876, category: 'Complexity' },
      { name: 'Imports Total B', contribution: 0.185, coverage: 0.271, normalizedEntropy: 0.851, category: 'Infrastructure' },
      { name: 'Functions Count B', contribution: 0.100, coverage: 0.271, normalizedEntropy: 0.612, category: 'Complexity' }
    ],
    technicalMetrics: {
      totalFiles: 140,
      kloc: 75.2,
      analysisTimestamp: new Date().toISOString(),
      algorithmVersion: 'improved-cci-entropy-v1.0'
    },
    entropyTimeSeries: generateMockEntropyTimeSeries(days),
    recommendations: [
      '🎯 Entropy levels are good - maintain current architectural patterns',
      '🔍 Consider standardizing import structures across modules'
    ]
  };
}