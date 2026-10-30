import dns from 'dns/promises';

/**
 * Checks if an IPv4 or IPv6 address is in a private, loopback, link-local, or cloud metadata range.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4 Checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed IPv4 is treated as dangerous
    }

    const p0 = parts[0] as number;
    const p1 = parts[1] as number;

    // 0.0.0.0/8
    if (p0 === 0) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (p0 === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;

    // 172.16.0.0/12 (Private RFC 1918)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (p0 === 192 && p1 === 168) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (p0 >= 224) return true;

    return false;
  }

  // IPv6 Checks
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  // fe80::/10 link-local
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // fc00::/7 unique local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities by resolving hostname to IP
 * and asserting it does not resolve to an internal network address.
 */
export async function validateSafeExternalUrl(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are permitted');
  }

  const hostname = parsed.hostname;

  // Reject local hostnames immediately
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Access to local/internal hostnames is blocked');
  }

  // Resolve hostname DNS records
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        throw new Error(`SSRF Block: Hostname ${hostname} resolves to restricted IP ${addr.address}`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes('SSRF Block')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for hostname ${hostname}: ${err.message}`);
  }

  return parsed;
}

