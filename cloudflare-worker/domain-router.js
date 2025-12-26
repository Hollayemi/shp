/**
 * Cloudflare Worker: Custom Domain Router
 * 
 * This worker routes custom domains to their corresponding project deployments.
 * 
 * Flow:
 * 1. User visits myapp.com (custom domain)
 * 2. Cloudflare for SaaS routes to fallback origin
 * 3. Worker intercepts via dashboard route (star/star) 
 * 4. Worker looks up which project owns myapp.com
 * 5. Worker proxies request to the actual deployment URL
 * 6. User sees their project at myapp.com
 */

// Modern ES modules format - required for proper env variable access
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  // Get configuration from environment (env is passed directly in ES modules format)
  const API_BASE_URL = env.API_BASE_URL || 'https://shipper-api-staging.up.railway.app';
  const API_KEY = env.API_KEY;
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  console.log(`[Worker] Incoming request for: ${hostname}`);
  console.log(`[Worker] API_BASE_URL: ${API_BASE_URL}`);
  console.log(`[Worker] API_KEY exists: ${!!API_KEY}`);
  
  // Simple test response to verify worker is working
  if (url.pathname === '/worker-test') {
    return new Response(`Worker is working! Hostname: ${hostname}, Time: ${new Date().toISOString()}`, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Pass through shipper.now main site and www subdomain (hosted on Vercel)
  if (hostname === 'shipper.now' || hostname === 'www.shipper.now') {
    console.log(`[Worker] Main site request, passing through to origin`);
    return fetch(request);
  }

  // Check if this is a regular shipper.now subdomain (not a custom domain)
  if (hostname.endsWith('.shipper.now') && hostname !== 'cname.shipper.now') {
    // This is a regular deployment subdomain like project-123.shipper.now
    // Pass through to deployment plane
    console.log(`[Worker] Regular subdomain, proxying directly`);
    return proxyToDeploymentPlane(request);
  }

  // This might be a custom domain - look it up
  try {
    console.log(`[Worker] Looking up domain: ${hostname}`);
    const domainInfo = await lookupDomain(hostname, API_BASE_URL, API_KEY);
    console.log(`[Worker] Domain lookup result:`, domainInfo);
    
    if (domainInfo && domainInfo.success && domainInfo.project) {
      console.log(`[Worker] Custom domain found, routing to project: ${domainInfo.project.id}`);
      console.log(`[Worker] Deployment URL: ${domainInfo.project.deploymentUrl}`);
      return proxyToProject(request, domainInfo.project, API_BASE_URL, API_KEY);
    } else {
      console.log(`[Worker] No project found. Domain info:`, domainInfo);
    }
  } catch (error) {
    console.error(`[Worker] Error looking up domain:`, error);
  }

  // Domain not found or error occurred
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Domain Not Found</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 3rem; margin: 0; }
          p { font-size: 1.2rem; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🌐 Domain Not Found</h1>
          <p>This domain is not connected to any project.</p>
          <p><small>${hostname}</small></p>
        </div>
      </body>
    </html>
    `,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
}

/**
 * Look up domain information from your API
 */
async function lookupDomain(hostname, apiBaseUrl, apiKey) {
  try {
    const url = `${apiBaseUrl}/api/v1/domains/lookup?domain=${encodeURIComponent(hostname)}`;
    console.log(`[Worker] Making API call to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey || '',
      },
      cf: {
        cacheTtl: 0,
      },
    });

    console.log(`[Worker] API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Worker] API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`[Worker] API response:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[Worker] Lookup error:', error);
    return null;
  }
}

/**
 * Fetch project metadata for meta tag injection
 */
async function fetchProjectMetadata(projectId, apiBaseUrl, apiKey) {
  try {
    const url = `${apiBaseUrl}/api/v1/domains/metadata/${encodeURIComponent(projectId)}`;
    console.log(`[Worker] Fetching metadata from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey || '',
      },
      cf: {
        cacheTtl: 300, // Cache for 5 minutes
      },
    });

    if (!response.ok) {
      console.warn(`[Worker] Metadata API error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    console.log(`[Worker] Metadata response:`, result);
    return result.success ? result.metadata : null;
  } catch (error) {
    console.error('[Worker] Metadata fetch error:', error);
    return null;
  }
}

/**
 * Inject metadata into HTML response
 */
function injectMetadata(html, metadata) {
  if (!metadata) return html;

  // Create meta tags
  const metaTags = [];
  
  // Basic meta tags
  if (metadata.title) {
    metaTags.push(`<title>${escapeHtml(metadata.title)}</title>`);
    metaTags.push(`<meta property="og:title" content="${escapeHtml(metadata.title)}" />`);
    metaTags.push(`<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`);
  }
  
  if (metadata.description) {
    metaTags.push(`<meta name="description" content="${escapeHtml(metadata.description)}" />`);
    metaTags.push(`<meta property="og:description" content="${escapeHtml(metadata.description)}" />`);
    metaTags.push(`<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`);
  }

  // Open Graph and Twitter meta tags
  metaTags.push(`<meta property="og:type" content="website" />`);
  metaTags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  
  if (metadata.shareImageUrl || metadata.ogImage) {
    const imageUrl = metadata.shareImageUrl || metadata.ogImage;
    metaTags.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}" />`);
    metaTags.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`);
  }

  if (metadata.iconUrl) {
    metaTags.push(`<link rel="icon" href="${escapeHtml(metadata.iconUrl)}" />`);
    metaTags.push(`<link rel="apple-touch-icon" href="${escapeHtml(metadata.iconUrl)}" />`);
  }

  // Inject meta tags into HTML head
  const metaTagsHtml = metaTags.join('\n  ');
  
  // Try to inject after existing <head> tag or before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${metaTagsHtml}\n</head>`);
  } else if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n  ${metaTagsHtml}`);
  } else {
    // Fallback: inject at the beginning of the document
    return `<!DOCTYPE html><html><head>\n  ${metaTagsHtml}\n</head><body>${html}</body></html>`;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Proxy request to the project's deployment
 */
async function proxyToProject(request, project, apiBaseUrl, apiKey) {
  const url = new URL(request.url);
  
  // Check payment status for custom domains
  if (project.paymentStatus === 'SUSPENDED') {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Subscription Required - ${project.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
              color: white;
              padding: 2rem;
            }
            .container {
              text-align: center;
              max-width: 600px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
              font-weight: 600;
            }
            p {
              font-size: 1.2rem;
              opacity: 0.95;
              line-height: 1.6;
              margin-bottom: 2rem;
            }
            .cta {
              display: inline-block;
              background: white;
              color: #DC2626;
              padding: 1rem 2rem;
              border-radius: 0.5rem;
              text-decoration: none;
              font-weight: 600;
              transition: transform 0.2s;
            }
            .cta:hover {
              transform: translateY(-2px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⚠️</div>
            <h1>Subscription Required</h1>
            <p>This custom domain requires an active subscription. The project owner needs to update their payment method to restore access.</p>
            <a href="https://shipper.now" class="cta">Go to Shipper</a>
          </div>
        </body>
      </html>
      `,
      {
        status: 402,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      }
    )
  }
  
  if (!project.deploymentUrl) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${project.name} - Coming Soon</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
              color: white;
              padding: 2rem;
            }
            .container { text-align: center; max-width: 600px; }
            .logo { font-size: 4rem; margin-bottom: 1rem; }
            h1 { font-size: 2.5rem; margin-bottom: 1rem; font-weight: 600; }
            p { font-size: 1.2rem; opacity: 0.95; line-height: 1.6; margin-bottom: 2rem; }
            .badge {
              display: inline-block;
              background: rgba(255, 255, 255, 0.2);
              padding: 0.5rem 1rem;
              border-radius: 2rem;
              font-size: 0.9rem;
              backdrop-filter: blur(10px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🚀</div>
            <h1>${project.name}</h1>
            <p>This project is being prepared for launch. The deployment will be available here soon!</p>
            <div class="badge">✨ Coming Soon</div>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
  
  let deploymentUrl = project.deploymentUrl;
  
  // Handle both full URLs and hostnames
  if (deploymentUrl.startsWith('http://') || deploymentUrl.startsWith('https://')) {
    const baseUrl = new URL(deploymentUrl);
    const targetUrl = new URL(url.pathname + url.search, baseUrl.origin);
    
    console.log(`[Worker] Proxying to: ${targetUrl}`);

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    try {
      const response = await fetch(modifiedRequest, {
        cf: {
          timeout: 8000,
          cacheTtl: 0
        }
      });
      
      console.log(`[Worker] Successfully fetched ${targetUrl}, status: ${response.status}`);
      
      // Check if this is an HTML response that we should inject metadata into
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const isMainPage = url.pathname === '/' || url.pathname === '/index.html';
      
      if (isHtml && isMainPage && response.status === 200) {
        console.log(`[Worker] HTML response detected, fetching metadata for injection`);
        
        // Fetch metadata for this project
        const metadata = await fetchProjectMetadata(project.id, apiBaseUrl, apiKey);
        
        if (metadata) {
          console.log(`[Worker] Injecting metadata into HTML response`);
          
          // Read the HTML content
          const html = await response.text();
          
          // Inject metadata
          const modifiedHtml = injectMetadata(html, metadata);
          
          // Return modified response
          return new Response(modifiedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.error(`[Worker] Error fetching ${targetUrl}:`, error.message);
      
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connection Error</title>
            <style>
              body { 
                font-family: system-ui; 
                text-align: center; 
                padding: 2rem; 
                background: #f8f9fa;
              }
              .error { color: #dc2626; margin-bottom: 1rem; }
              .details { color: #6b7280; font-size: 0.9rem; }
            </style>
          </head>
          <body>
            <h1 class="error">🔌 Connection Error</h1>
            <p>Unable to connect to the origin server.</p>
            <p class="details">Error: ${error.message}</p>
          </body>
        </html>
        `, 
        { 
          status: 502,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
  }
  
  // Construct the target URL from hostname
  const targetUrl = new URL(url.pathname + url.search, `https://${deploymentUrl}`);
  
  console.log(`[Worker] Proxying to: ${targetUrl}`);

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual',
  });

  try {
    const response = await fetch(modifiedRequest, {
      cf: {
        timeout: 8000,
        cacheTtl: 0
      }
    });
    
    console.log(`[Worker] Successfully fetched ${targetUrl}, status: ${response.status}`);
    
    // Check if this is an HTML response that we should inject metadata into
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    const isMainPage = url.pathname === '/' || url.pathname === '/index.html';
    
    if (isHtml && isMainPage && response.status === 200) {
      console.log(`[Worker] HTML response detected, fetching metadata for injection`);
      
      // Fetch metadata for this project
      const metadata = await fetchProjectMetadata(project.id, apiBaseUrl, apiKey);
      
      if (metadata) {
        console.log(`[Worker] Injecting metadata into HTML response`);
        
        // Read the HTML content
        const html = await response.text();
        
        // Inject metadata
        const modifiedHtml = injectMetadata(html, metadata);
        
        // Return modified response
        return new Response(modifiedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error(`[Worker] Error fetching ${targetUrl}:`, error.message);
    
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Error</title>
          <style>
            body { 
              font-family: system-ui; 
              text-align: center; 
              padding: 2rem; 
              background: #f8f9fa;
            }
            .error { color: #dc2626; margin-bottom: 1rem; }
            .details { color: #6b7280; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <h1 class="error">🔌 Connection Error</h1>
          <p>Unable to connect to the origin server.</p>
          <p class="details">Error: ${error.message}</p>
        </body>
      </html>
      `, 
      { 
        status: 502,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * Proxy to deployment plane for regular subdomains
 */
async function proxyToDeploymentPlane(request) {
  return fetch(request);
}