class PerformanceMonitor {
  constructor(scene) {
    this.scene = scene;
    this.metrics = {
      assetLoading: {},
      sceneOperations: {},
      fps: [],
      memory: [],
      textureMemory: {},
      heapAllocations: {},
      playerMovement: []
    };
    
    this.timers = {};
    this.enabled = true;
    this.overlayVisible = false;
    this.overlay = null;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.currentFps = 0;
    
    // Player movement tracking
    this.lastPlayerPos = null;
    this.lastMovementUpdate = performance.now();
    this.effectiveSpeed = 0;
  }

  startTimer(label) {
    if (!this.enabled) return;
    this.timers[label] = performance.now();
  }

  endTimer(label, category = 'sceneOperations') {
    if (!this.enabled || !this.timers[label]) return;
    
    const duration = performance.now() - this.timers[label];
    delete this.timers[label];
    
    if (!this.metrics[category][label]) {
      this.metrics[category][label] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        lastTime: 0
      };
    }
    
    const metric = this.metrics[category][label];
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.minTime = Math.min(metric.minTime, duration);
    metric.lastTime = duration;
    
    return duration;
  }

  trackAssetLoad(assetKey, type, size = null) {
    if (!this.enabled) return;
    
    const texture = this.scene.textures?.get?.(assetKey);
    if (texture && texture.source && texture.source[0]) {
      const source = texture.source[0];
      const estimatedSize = source.width * source.height * 4;
      
      this.metrics.textureMemory[assetKey] = {
        type: type,
        width: source.width,
        height: source.height,
        estimatedBytes: estimatedSize,
        estimatedKB: (estimatedSize / 1024).toFixed(2),
        estimatedMB: (estimatedSize / (1024 * 1024)).toFixed(2)
      };
    }
  }

  updateFPS() {
    if (!this.enabled) return;
    
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;
    
    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.metrics.fps.push({
        timestamp: now - this.startTime,
        fps: this.currentFps
      });
      
      if (this.metrics.fps.length > 60) {
        this.metrics.fps.shift();
      }
      
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  updateMemory() {
    if (!this.enabled || !performance.memory) return;
    
    const mem = performance.memory;
    const memEntry = {
      timestamp: performance.now() - this.startTime,
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit
    };
    
    this.metrics.memory.push(memEntry);
    
    if (this.metrics.memory.length > 60) {
      this.metrics.memory.shift();
    }
    
    // Snapshot actual heap contents
    this.snapshotHeapContents();
  }
  
  snapshotHeapContents() {
    if (!this.enabled) return;
    
    const snapshot = {
      timestamp: performance.now() - this.startTime,
      phaser: this.estimatePhaserMemory(),
      gameObjects: this.countGameObjects(),
      textures: Object.keys(this.metrics.textureMemory).length,
      textureMemory: this.getTotalTextureMemory().bytes,
      domElements: document.querySelectorAll('*').length,
      eventListeners: this.estimateEventListeners()
    };
    
    // Calculate estimated sizes
    const estimates = {
      'Phaser Framework': snapshot.phaser.estimatedBytes,
      'Textures': snapshot.textureMemory,
      'Game Objects': snapshot.gameObjects.total * 1024, // ~1KB per object estimate
      'DOM Elements': snapshot.domElements * 500, // ~500 bytes per element estimate
      'Event Listeners': snapshot.eventListeners * 200, // ~200 bytes per listener estimate
      'Player Data (inventory, skills, etc)': this.estimatePlayerDataSize()
    };
    
    this.metrics.heapAllocations = {};
    for (const [source, bytes] of Object.entries(estimates)) {
      if (bytes > 0) {
        this.metrics.heapAllocations[source] = {
          estimatedBytes: bytes,
          estimatedMB: (bytes / (1024 * 1024)).toFixed(2),
          count: 1,
          lastUpdate: snapshot.timestamp
        };
      }
    }
    
    return snapshot;
  }
  
  estimatePhaserMemory() {
    const scene = this.scene;
    if (!scene || !scene.sys) return { estimatedBytes: 0, details: 'No scene' };
    
    // Phaser core + plugins + systems
    const coreEstimate = 5 * 1024 * 1024; // ~5MB for Phaser core
    const pluginEstimate = scene.plugins ? Object.keys(scene.plugins.plugins || {}).length * 500000 : 0;
    
    return {
      estimatedBytes: coreEstimate + pluginEstimate,
      core: coreEstimate,
      plugins: pluginEstimate
    };
  }
  
  countGameObjects() {
    const scene = this.scene;
    if (!scene || !scene.children) return { total: 0 };
    
    const children = scene.children.list || [];
    const counts = {
      total: children.length,
      sprites: 0,
      graphics: 0,
      text: 0,
      containers: 0,
      other: 0
    };
    
    children.forEach(obj => {
      if (obj.type === 'Sprite') counts.sprites++;
      else if (obj.type === 'Graphics') counts.graphics++;
      else if (obj.type === 'Text') counts.text++;
      else if (obj.type === 'Container') counts.containers++;
      else counts.other++;
    });
    
    return counts;
  }
  
  estimateEventListeners() {
    // Rough estimate based on game systems
    let count = 0;
    
    // Scene events
    if (this.scene && this.scene.events) count += 10;
    
    // Input events (keyboard, pointer)
    if (this.scene && this.scene.input) count += 20;
    
    // Physics events
    if (this.scene && this.scene.physics) count += 5;
    
    // Custom game events
    count += Object.keys(window.playerSkills || {}).length * 2;
    count += (window.inventory?.length || 0);
    
    return count;
  }
  
  estimatePlayerDataSize() {
    let bytes = 0;
    
    // Inventory (items are objects with properties)
    if (window.inventory) {
      bytes += window.inventory.length * 500; // ~500 bytes per item
    }
    
    // Equipment
    if (window.equipment) {
      bytes += Object.keys(window.equipment).length * 500;
    }
    
    // Skills
    if (window.playerSkills) {
      bytes += Object.keys(window.playerSkills).length * 200;
    }
    
    // Material storage
    if (window.materialStorage) {
      bytes += Object.keys(window.materialStorage).length * 100;
    }
    
    return bytes;
  }
  
  updatePlayerMovement(player) {
    if (!this.enabled || !player || !player.x || !player.y) return;
    
    const now = performance.now();
    
    if (!this.lastPlayerPos) {
      this.lastPlayerPos = { x: player.x, y: player.y };
      this.lastMovementUpdate = now;
      return;
    }
    
    const timeDelta = (now - this.lastMovementUpdate) / 1000; // seconds
    if (timeDelta < 0.1) return; // Update every 100ms
    
    const dx = player.x - this.lastPlayerPos.x;
    const dy = player.y - this.lastPlayerPos.y;
    const distance = Math.hypot(dx, dy);
    
    this.effectiveSpeed = distance / timeDelta;
    
    this.metrics.playerMovement.push({
      timestamp: now - this.startTime,
      speed: this.effectiveSpeed,
      targetSpeed: typeof playerSpeed !== 'undefined' ? playerSpeed : 0,
      fps: this.currentFps
    });
    
    if (this.metrics.playerMovement.length > 60) {
      this.metrics.playerMovement.shift();
    }
    
    this.lastPlayerPos = { x: player.x, y: player.y };
    this.lastMovementUpdate = now;
  }

  getTotalTextureMemory() {
    let total = 0;
    Object.values(this.metrics.textureMemory).forEach(tex => {
      total += tex.estimatedBytes;
    });
    return {
      bytes: total,
      kb: (total / 1024).toFixed(2),
      mb: (total / (1024 * 1024)).toFixed(2)
    };
  }

  getReport() {
    const report = {
      summary: {
        totalRunTime: ((performance.now() - this.startTime) / 1000).toFixed(2) + 's',
        currentFPS: this.currentFps,
        avgFPS: this.getAverageFPS(),
        minFPS: this.getMinFPS(),
        maxFPS: this.getMaxFPS(),
        textureMemoryUsed: this.getTotalTextureMemory(),
        textureCount: Object.keys(this.metrics.textureMemory).length,
        effectivePlayerSpeed: this.effectiveSpeed.toFixed(1) + ' px/s',
        targetPlayerSpeed: (typeof playerSpeed !== 'undefined' ? playerSpeed : 0) + ' px/s'
      },
      assetLoading: this.metrics.assetLoading,
      sceneOperations: this.getSortedOperations(),
      textures: this.getSortedTextures(),
      slowestOperations: this.getSlowestOperations(5),
      largestTextures: this.getLargestTextures(5),
      heapAllocations: this.getSortedHeapAllocations(),
      topHeapAllocations: this.getTopHeapAllocations(5)
    };
    
    if (performance.memory) {
      const latest = this.metrics.memory[this.metrics.memory.length - 1];
      if (latest) {
        report.summary.memoryUsed = (latest.usedJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB';
        report.summary.memoryTotal = (latest.totalJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB';
        report.summary.memoryLimit = (latest.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + ' MB';
        
        // Calculate memory growth rate
        if (this.metrics.memory.length > 10) {
          const old = this.metrics.memory[this.metrics.memory.length - 10];
          const growth = latest.usedJSHeapSize - old.usedJSHeapSize;
          report.summary.memoryGrowthRate = (growth / (1024 * 1024)).toFixed(2) + ' MB/20s';
        }
      }
    }
    
    return report;
  }
  
  getSortedHeapAllocations() {
    return Object.entries(this.metrics.heapAllocations)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.estimatedBytes || b.totalBytes || 0) - (a.estimatedBytes || a.totalBytes || 0));
  }
  
  getTopHeapAllocations(count = 10) {
    return this.getSortedHeapAllocations().slice(0, count);
  }

  getAverageFPS() {
    if (this.metrics.fps.length === 0) return 0;
    const sum = this.metrics.fps.reduce((acc, entry) => acc + entry.fps, 0);
    return Math.round(sum / this.metrics.fps.length);
  }

  getMinFPS() {
    if (this.metrics.fps.length === 0) return 0;
    return Math.min(...this.metrics.fps.map(e => e.fps));
  }

  getMaxFPS() {
    if (this.metrics.fps.length === 0) return 0;
    return Math.max(...this.metrics.fps.map(e => e.fps));
  }

  getSortedOperations() {
    return Object.entries(this.metrics.sceneOperations)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  getSortedTextures() {
    return Object.entries(this.metrics.textureMemory)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.estimatedBytes - a.estimatedBytes);
  }

  getSlowestOperations(count = 5) {
    return this.getSortedOperations().slice(0, count);
  }

  getLargestTextures(count = 5) {
    return this.getSortedTextures().slice(0, count);
  }

  createOverlay() {
    if (this.overlay) return;
    
    const cam = this.scene.cameras.main;
    this.overlay = this.scene.add.container(10, 10)
      .setDepth(9999)
      .setScrollFactor(0);
    
    const bgWidth = 400;
    const bgHeight = 350;
    const bg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(0, 0, bgWidth, bgHeight, 8)
      .lineStyle(2, 0x00ff00, 0.8)
      .strokeRoundedRect(0, 0, bgWidth, bgHeight, 8);
    
    this.overlay.add(bg);
    
    this.overlayText = this.scene.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff00',
      lineSpacing: 4
    });
    
    this.overlay.add(this.overlayText);
    this.overlay.setVisible(false);
  }

  updateOverlay() {
    if (!this.overlay || !this.overlayVisible) return;
    
    const report = this.getReport();
    const totalMem = this.getTotalTextureMemory();
    
    let text = `=== PERFORMANCE MONITOR ===\n`;
    text += `FPS: ${this.currentFps} (avg: ${report.summary.avgFPS}, min: ${report.summary.minFPS}, max: ${report.summary.maxFPS})\n`;
    text += `Runtime: ${report.summary.totalRunTime}\n`;
    text += `Player Speed: ${report.summary.effectivePlayerSpeed} / ${report.summary.targetPlayerSpeed}\n`;
    text += `Textures: ${report.summary.textureCount} (${totalMem.mb} MB)\n`;
    
    if (report.summary.memoryUsed) {
      text += `JS Heap: ${report.summary.memoryUsed} / ${report.summary.memoryLimit}\n`;
      if (report.summary.memoryGrowthRate) {
        text += `Memory Growth: ${report.summary.memoryGrowthRate}\n`;
      }
    }
    
    text += `\n--- Top 5 Slowest Operations ---\n`;
    report.slowestOperations.forEach((op, i) => {
      text += `${i + 1}. ${op.name}: ${op.lastTime.toFixed(2)}ms (avg: ${op.avgTime.toFixed(2)}ms)\n`;
    });
    
    if (report.topHeapAllocations && report.topHeapAllocations.length > 0) {
      text += `\n--- Heap Contents (Estimated) ---\n`;
      let totalEstimated = 0;
      report.topHeapAllocations.forEach((alloc, i) => {
        const bytes = alloc.estimatedBytes || alloc.totalBytes || 0;
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        totalEstimated += bytes;
        text += `${i + 1}. ${alloc.name}: ${mb} MB\n`;
      });
      const totalMB = (totalEstimated / (1024 * 1024)).toFixed(2);
      const actualMB = report.summary.memoryUsed ? parseFloat(report.summary.memoryUsed) : 0;
      const unaccounted = actualMB - parseFloat(totalMB);
      text += `Total Estimated: ${totalMB} MB\n`;
      if (unaccounted > 0) {
        text += `Unaccounted: ${unaccounted.toFixed(2)} MB (closures, strings, etc)\n`;
      }
    }
    
    text += `\nPress P to toggle this overlay`;
    
    this.overlayText.setText(text);
  }

  toggleOverlay() {
    if (!this.overlay) {
      this.createOverlay();
    }
    this.overlayVisible = !this.overlayVisible;
    this.overlay.setVisible(this.overlayVisible);
    if (this.overlayVisible) {
      this.updateOverlay();
    }
  }

  printReport() {
    const report = this.getReport();
    console.log('=== PERFORMANCE REPORT ===');
    console.log('Summary:', report.summary);
    console.log('\nScene Operations (sorted by total time):');
    report.sceneOperations.forEach(op => {
      console.log(`  ${op.name}:`, {
        count: op.count,
        total: op.totalTime.toFixed(2) + 'ms',
        avg: op.avgTime.toFixed(2) + 'ms',
        min: op.minTime.toFixed(2) + 'ms',
        max: op.maxTime.toFixed(2) + 'ms',
        last: op.lastTime.toFixed(2) + 'ms'
      });
    });
    
    console.log('\nTexture Memory (sorted by size):');
    report.textures.forEach(tex => {
      console.log(`  ${tex.name}:`, {
        type: tex.type,
        size: `${tex.width}x${tex.height}`,
        memory: `${tex.estimatedKB} KB (${tex.estimatedMB} MB)`
      });
    });
    
    console.log('\nSlowest Operations:', report.slowestOperations);
    console.log('\nLargest Textures:', report.largestTextures);
    
    if (report.topHeapAllocations && report.topHeapAllocations.length > 0) {
      console.log('\nHeap Contents (Estimated):', report.topHeapAllocations);
      
      const totalEstimated = report.topHeapAllocations.reduce((sum, alloc) => {
        return sum + (alloc.estimatedBytes || alloc.totalBytes || 0);
      }, 0);
      
      const totalMB = (totalEstimated / (1024 * 1024)).toFixed(2);
      const actualMB = report.summary.memoryUsed ? parseFloat(report.summary.memoryUsed) : 0;
      const unaccounted = actualMB - parseFloat(totalMB);
      
      console.log('\nMemory Breakdown:', {
        totalEstimated: totalMB + ' MB',
        actualUsed: actualMB.toFixed(2) + ' MB',
        unaccounted: unaccounted.toFixed(2) + ' MB (JavaScript closures, strings, cached data, etc)'
      });
    }
    
    console.log('\nPlayer Movement:', {
      effectiveSpeed: report.summary.effectivePlayerSpeed,
      targetSpeed: report.summary.targetPlayerSpeed,
      samples: this.metrics.playerMovement.length
    });
  }

  destroy() {
    if (this.overlay) {
      this.overlay.destroy(true);
      this.overlay = null;
    }
    this.metrics = null;
    this.timers = null;
  }
}

window.PerformanceMonitor = PerformanceMonitor;
