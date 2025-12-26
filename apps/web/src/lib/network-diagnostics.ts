// src/lib/network-diagnostics.ts
export class NetworkDiagnostics {
  static async testConnectivity() {
    const results = [];
    
    // Test Google Fonts
    try {
      const start = performance.now();
      const response = await fetch('https://fonts.googleapis.com/css2?family=Geist:wght@400&display=swap', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      const duration = performance.now() - start;
      results.push({ 
        service: 'Google Fonts', 
        status: response.ok ? 'OK' : 'FAIL', 
        duration: Math.round(duration),
        statusCode: response.status
      });
    } catch (error) {
      results.push({ 
        service: 'Google Fonts', 
        status: 'ERROR', 
        duration: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test E2B (if we can determine the endpoint)
    try {
      const start = performance.now();
      // This is a generic connectivity test
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      const duration = performance.now() - start;
      results.push({ 
        service: 'General Internet', 
        status: response.ok ? 'OK' : 'FAIL', 
        duration: Math.round(duration),
        statusCode: response.status
      });
    } catch (error) {
      results.push({ 
        service: 'General Internet', 
        status: 'ERROR', 
        duration: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  static async logNetworkHealth() {
    console.log('🌐 [NetworkDiag] Running connectivity tests...');
    const results = await this.testConnectivity();
    
    results.forEach(result => {
      const icon = result.status === 'OK' ? '✅' : result.status === 'FAIL' ? '❌' : '🔴';
      console.log(`${icon} [NetworkDiag] ${result.service}: ${result.status} (${result.duration}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    return results;
  }
} 