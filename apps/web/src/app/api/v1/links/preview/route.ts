import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSafeExternalUrl } from '@/lib/security/ssrf';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }

  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'BAD_REQUEST', message: 'Query parameter url is required' }, { status: 400 });
  }

  let validUrl: URL;
  try {
    validUrl = await validateSafeExternalUrl(rawUrl);
  } catch (err: any) {
    return NextResponse.json({ error: 'BLOCKED_BY_SSRF', message: err.message }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(validUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProjectHubBot/1.0; +https://projecthub.company)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({
        title: validUrl.hostname,
        description: null,
        image: null,
        url: validUrl.toString(),
      });
    }

    const html = await response.text();

    // Extract title, description, and image using regex
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

    const title = (titleMatch && titleMatch[1]) ? titleMatch[1].trim() : validUrl.hostname;
    const description = (descMatch && descMatch[1]) ? descMatch[1].trim() : null;
    let image = (imageMatch && imageMatch[1]) ? imageMatch[1].trim() : null;

    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      image = new URL(image, validUrl).toString();
    }

    return NextResponse.json({
      title,
      description,
      image,
      url: validUrl.toString(),
      siteName: validUrl.hostname,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'FETCH_FAILED', message: err.message || 'Failed to fetch link preview' },
      { status: 502 }
    );
  }
}

