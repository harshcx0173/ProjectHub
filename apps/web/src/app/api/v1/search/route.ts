import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: results, error: searchError } = await supabase.rpc('global_search', {
      p_query: query.trim(),
    });

    if (searchError) {
      return NextResponse.json({ error: 'SEARCH_FAILED', message: searchError.message }, { status: 500 });
    }

    const formatted = (results || []).map((r: any) => ({
      resultType: r.result_type,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      projectId: r.project_id,
      projectName: r.project_name,
      url: r.url,
    }));

    return NextResponse.json({ results: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
