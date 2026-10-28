import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Fetch channels for project
    let { data: channels, error } = await supabase
      .from('project_channels')
      .select('id, name, description, is_default, created_at')
      .eq('project_id', projectId)
      .order('is_default', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    // Auto-create default 'general' channel if none exists
    if (!channels || channels.length === 0) {
      const { data: newChan, error: createErr } = await supabase
        .from('project_channels')
        .insert({
          project_id: projectId,
          name: 'general',
          description: 'Default project discussion channel',
          is_default: true,
        })
        .select()
        .single();

      if (!createErr && newChan) {
        channels = [newChan];
      }
    }

    return NextResponse.json({ channels: channels || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
