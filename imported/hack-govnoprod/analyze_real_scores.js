// Comprehensive analysis of entropy-based scoring system
const fs = require('fs');
const path = require('path');

function analyzeEntropyScoring() {
  try {
    const auditDir = '.audit';
    const files = fs.readdirSync(auditDir);
    const entropyFile = files.find(f => f.startsWith('entropy-result-'));
    
    if (!entropyFile) {
      console.log('❌ No entropy result file found');
      return;
    }
    
    console.log(`📊 Analyzing: ${entropyFile}`);
    const data = JSON.parse(fs.readFileSync(path.join(auditDir, entropyFile), 'utf8'));
    
    console.log('\n=== 🎯 REAL CCI & ALL SCORES ===\n');
    
    // Main scores
    console.log('📈 PRIMARY METRICS:');
    console.log(`🔹 Entropy Score: ${data.entropy.toFixed(2)} (lower = more consistent)`);
    console.log(`🔹 CCI (Real): ${data.cci.toFixed(2)} (higher = better quality)`);  
    console.log(`🔹 CDX: ${data.details.details.scores.CDX.toFixed(2)} (defects per KLOC)`);
    console.log(`🔹 Total Files: ${data.details.details.provenance.n_files}`);
    console.log(`🔹 KLOC: ${data.details.details.provenance.kloc}`);
    
    // Group breakdown
    console.log('\n📊 GROUP ANALYSIS:');
    const groups = data.details.details.by_group;
    for (const [groupName, groupData] of Object.entries(groups)) {
      console.log(`\n🏗️  ${groupName.toUpperCase()}:`);
      console.log(`   CCI: ${groupData.scores.CCI.toFixed(2)}`);
      console.log(`   CDX: ${groupData.scores.CDX.toFixed(2)}`);
    }
    
    // Entropy contributions (top contributors)
    console.log('\n🧬 TOP ENTROPY CONTRIBUTORS:');
    const entropyContribs = data.details.details.decomposition
      .filter(d => d.type === 'entropy' && d.contrib > 0)
      .sort((a, b) => b.contrib - a.contrib)
      .slice(0, 8);
      
    entropyContribs.forEach(item => {
      console.log(`   ${item.name}: ${item.contrib.toFixed(3)} (coverage: ${(item.coverage * 100).toFixed(1)}%)`);
    });
    
    // Finding contributions (top contributors)
    console.log('\n🔍 TOP FINDING CONTRIBUTORS:');
    const findingContribs = data.details.details.decomposition
      .filter(d => d.type === 'finding' && d.contrib > 0)
      .sort((a, b) => b.contrib - a.contrib)
      .slice(0, 10);
      
    findingContribs.forEach(item => {
      console.log(`   ${item.kind}: ${item.count} occurrences → ${item.contrib.toFixed(3)} impact`);
    });
    
    // HPC rules (if any violations)
    console.log('\n⚡ HPC RULE VIOLATIONS:');
    const hpcViolations = data.details.details.decomposition
      .filter(d => d.type === 'hpc' && d.contrib > 0);
      
    if (hpcViolations.length > 0) {
      hpcViolations.forEach(item => {
        console.log(`   ${item.rule}: ${item.rate.toFixed(3)} rate → ${item.contrib.toFixed(3)} impact`);
      });
    } else {
      console.log('   ✅ No HPC rule violations detected');
    }
    
    // Summary comparison
    console.log('\n📋 SCORING SYSTEM COMPARISON:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                 Simple Extension vs Real Entropy        │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Files analyzed:   ${7.965.toFixed(0)} KLOC  vs  ${data.details.details.provenance.kloc} KLOC     │`);
    console.log(`│ CCI Score:        10        vs  ${data.cci.toFixed(2)}           │`);
    console.log(`│ Analysis depth:   Basic     vs  Multi-dimensional    │`);
    console.log(`│ Accuracy:         Low       vs  High                 │`);
    console.log('└─────────────────────────────────────────────────────────┘');
    
    // Recommendations
    console.log('\n💡 KEY INSIGHTS:');
    console.log('🎯 Use Entropy-based CCI (87.82) as authoritative score');
    console.log('🎯 Focus on reducing entropy contributors (imports, complexity)');
    console.log('🎯 Address db_naming_mismatch (highest finding contribution)');
    console.log('🎯 Optimize import_map structure (262 occurrences)');
    
    // Export for dashboard integration
    const dashboardData = {
      realCCI: data.cci,
      entropy: data.entropy,
      cdx: data.details.details.scores.CDX,
      totalFiles: data.details.details.provenance.n_files,
      kloc: data.details.details.provenance.kloc,
      groups: Object.fromEntries(
        Object.entries(groups).map(([name, group]) => [
          name, 
          { cci: group.scores.CCI, cdx: group.scores.CDX }
        ])
      ),
      topContributors: {
        entropy: entropyContribs.slice(0, 5),
        findings: findingContribs.slice(0, 5),
        hpc: hpcViolations
      }
    };
    
    // Save dashboard data
    fs.writeFileSync('.audit/dashboard-real-scores.json', JSON.stringify(dashboardData, null, 2));
    console.log('\n💾 Real scores saved to .audit/dashboard-real-scores.json');
    
    return dashboardData;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run analysis
analyzeEntropyScoring();