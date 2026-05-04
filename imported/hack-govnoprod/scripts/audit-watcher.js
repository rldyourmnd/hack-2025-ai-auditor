#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

/**
 * CCI Audit File Watcher Service
 * 
 * Monitors the .audit directory for changes in:
 * - findings_*.json files (CCI scan results)
 * - entropy-result-*.json files (entropy analysis)
 * - profiles.jsonl files (PFP profiles)
 * 
 * Future enhancements:
 * - WebSocket server to push real-time updates to dashboard
 * - Data aggregation and caching layer
 * - Alert notifications for critical findings
 */

class AuditWatcher {
  constructor(auditDir = '.audit') {
    this.auditDir = path.resolve(auditDir);
    this.watchedFiles = new Map();
    this.lastProcessedTime = Date.now();
    
    console.log(`🔍 CCI Audit Watcher starting...`);
    console.log(`📁 Monitoring directory: ${this.auditDir}`);
  }

  async start() {
    // Check if audit directory exists
    if (!fs.existsSync(this.auditDir)) {
      console.log(`⚠️  Audit directory not found: ${this.auditDir}`);
      console.log(`📂 Creating audit directory...`);
      fs.mkdirSync(this.auditDir, { recursive: true });
    }

    // Initial scan
    await this.scanAuditDirectory();

    // Set up file system watcher
    this.setupFileWatcher();

    console.log(`✅ Audit watcher is now active`);
    console.log(`🔄 Checking for changes every 5 seconds...`);
    console.log(`💡 Press Ctrl+C to stop`);
  }

  async scanAuditDirectory() {
    try {
      const files = fs.readdirSync(this.auditDir);
      const jsonFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.jsonl'));
      
      console.log(`📊 Found ${jsonFiles.length} audit files:`);
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.auditDir, file);
        const stats = fs.statSync(filePath);
        
        this.watchedFiles.set(file, {
          path: filePath,
          lastModified: stats.mtime.getTime(),
          size: stats.size,
          type: this.getFileType(file)
        });

        console.log(`  📄 ${file} (${this.formatFileSize(stats.size)}) - ${this.getFileType(file)}`);
      }

    } catch (error) {
      console.error(`❌ Error scanning audit directory:`, error.message);
    }
  }

  setupFileWatcher() {
    // Use fs.watch for directory monitoring
    fs.watch(this.auditDir, { recursive: false }, (eventType, filename) => {
      if (filename && (filename.endsWith('.json') || filename.endsWith('.jsonl'))) {
        this.handleFileChange(filename, eventType);
      }
    });

    // Backup polling mechanism
    setInterval(() => {
      this.pollForChanges();
    }, 5000);
  }

  async handleFileChange(filename, eventType) {
    const filePath = path.join(this.auditDir, filename);
    
    try {
      // Check if file exists and get stats
      if (!fs.existsSync(filePath)) {
        // File deleted
        if (this.watchedFiles.has(filename)) {
          console.log(`🗑️  File deleted: ${filename}`);
          this.watchedFiles.delete(filename);
          this.onFileDeleted(filename);
        }
        return;
      }

      const stats = fs.statSync(filePath);
      const currentModTime = stats.mtime.getTime();
      const fileType = this.getFileType(filename);

      const existingFile = this.watchedFiles.get(filename);
      
      if (!existingFile || existingFile.lastModified < currentModTime) {
        // New or modified file
        const isNew = !existingFile;
        
        this.watchedFiles.set(filename, {
          path: filePath,
          lastModified: currentModTime,
          size: stats.size,
          type: fileType
        });

        if (isNew) {
          console.log(`🆕 New audit file detected: ${filename} (${this.formatFileSize(stats.size)})`);
          await this.onNewFile(filename, filePath, fileType);
        } else {
          console.log(`📝 File modified: ${filename} (${this.formatFileSize(stats.size)})`);
          await this.onFileModified(filename, filePath, fileType);
        }
      }

    } catch (error) {
      console.error(`❌ Error handling file change for ${filename}:`, error.message);
    }
  }

  async pollForChanges() {
    try {
      const files = fs.readdirSync(this.auditDir);
      const jsonFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.jsonl'));
      
      for (const file of jsonFiles) {
        await this.handleFileChange(file, 'change');
      }
    } catch (error) {
      // Directory might not exist or be accessible
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error polling for changes:`, error.message);
      }
    }
  }

  async onNewFile(filename, filePath, fileType) {
    console.log(`🔍 Processing new ${fileType} file...`);
    
    try {
      const data = await this.parseAuditFile(filePath, fileType);
      
      if (data) {
        console.log(`📈 Analysis summary:`);
        
        switch (fileType) {
          case 'findings':
            console.log(`  • CCI Score: ${data.meta?.cci?.toFixed(1) || 'N/A'}`);
            console.log(`  • Total Findings: ${data.findings?.length || 0}`);
            console.log(`  • KLOC: ${data.meta?.kiloc?.toFixed(1) || 'N/A'}`);
            break;
            
          case 'entropy':
            console.log(`  • Entropy (CDX): ${data.entropy?.toFixed(1) || 'N/A'}`);
            console.log(`  • CCI Score: ${data.cci?.toFixed(1) || 'N/A'}`);
            console.log(`  • Files Analyzed: ${data.details?.details?.provenance?.n_files || 'N/A'}`);
            break;
            
          case 'profiles':
            const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim()).length;
            console.log(`  • Profile Entries: ${lineCount}`);
            break;
        }
        
        // Trigger dashboard refresh
        this.notifyDashboard(fileType, data);
      }
      
    } catch (error) {
      console.error(`❌ Error processing file ${filename}:`, error.message);
    }
  }

  async onFileModified(filename, filePath, fileType) {
    // Handle modified files (similar to new files)
    await this.onNewFile(filename, filePath, fileType);
  }

  onFileDeleted(filename) {
    // Handle deleted files
    console.log(`🧹 Cleaning up references to deleted file: ${filename}`);
  }

  async parseAuditFile(filePath, fileType) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (fileType === 'profiles') {
        // JSONL format
        const lines = content.split('\n').filter(line => line.trim());
        return { profileCount: lines.length };
      } else {
        // JSON format
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`❌ Error parsing ${fileType} file:`, error.message);
      return null;
    }
  }

  notifyDashboard(fileType, data) {
    // TODO: Implement WebSocket or Server-Sent Events to notify dashboard
    console.log(`📡 Dashboard notification: ${fileType} data updated`);
    
    // For now, just log the event
    const timestamp = new Date().toISOString();
    console.log(`🕒 Timestamp: ${timestamp}`);
    
    // Future implementation:
    // this.websocketServer.broadcast({
    //   type: 'audit-update',
    //   fileType,
    //   timestamp,
    //   data: this.extractKeyMetrics(data, fileType)
    // });
  }

  getFileType(filename) {
    if (filename.startsWith('findings_')) return 'findings';
    if (filename.startsWith('entropy-result-')) return 'entropy';
    if (filename.includes('profiles') && filename.endsWith('.jsonl')) return 'profiles';
    return 'unknown';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// CLI Usage
if (require.main === module) {
  const auditDir = process.argv[2] || '.audit';
  const watcher = new AuditWatcher(auditDir);
  
  watcher.start().catch(error => {
    console.error('❌ Failed to start audit watcher:', error.message);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping audit watcher...');
    process.exit(0);
  });
}

module.exports = AuditWatcher;