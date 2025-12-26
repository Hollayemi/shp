# Domain CNAME Fix

## Problem
Custom domains were receiving incorrect CNAME targets, causing circular DNS references. The system was returning the custom domain itself as the CNAME target instead of the Cloudflare CDN endpoint.

## Solution
Introduced `getCnameTarget()` helper function in `cloudflare-saas.ts` that:
- Extracts the correct CNAME target from Cloudflare's API response
- Checks multiple possible fields (`ssl.cname_target` and `ssl.cname`)
- Provides a fallback construction if neither field is available
- Logs warnings when fallback is used for debugging

## Changes
- Added `getCnameTarget()` function to extract CNAME from Cloudflare response
- Updated domain routes to use the new helper
- Removed mock service logic to simplify the codebase
- Fixed circular DNS reference issue

## Testing
Verify that custom domains now receive the correct CNAME target (e.g., `example.com.cdn.cloudflare.net`) instead of pointing to themselves.
