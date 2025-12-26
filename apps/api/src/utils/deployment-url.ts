/**
 * Utility functions for deployment URL handling
 */

/**
 * Force HTTPS for staging and production deployment URLs
 * @param deploymentUrl - The deployment URL to check and convert
 * @param context - Context for logging (e.g., 'ModalSandboxManager', 'DaytonaSandboxManager')
 * @returns The URL with HTTPS enforced if it was a staging/production deployment
 */
export function forceHttpsForDeployments(deploymentUrl: string, context: string): string {
  const originalUrl = deploymentUrl;
  
  // Force HTTPS for staging/production deployments
  if (deploymentUrl.startsWith('http://') && 
      (deploymentUrl.includes('.deploy-staging.shipper.now') || 
       deploymentUrl.includes('.deploy.shipper.now'))) {
    
    const convertedUrl = deploymentUrl.replace('http://', 'https://');
    
    console.log(`[${context}] Converted deployment URL from HTTP to HTTPS:`, {
      originalUrl,
      convertedUrl,
    });
    
    return convertedUrl;
  }
  
  return deploymentUrl;
}