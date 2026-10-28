import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';

const ALLOWED_ICONS = ['thumbs-up', 'check', 'heart', 'flag', 'eye'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasPostPerm = await checkUserPermission(user.id, 'chat.send');
    if (!hasPostPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing chat.send permission' }, { status: 403 });
    }

    const body = await request.json();
    const iconName = body.iconName;

    if (!ALLOWED_ICONS.includes(iconName)) {
      return NextResponse.json({ error: 'INVALID_ICON', message: 'Icon not permitted' }, { status: 400 });
    }

    // Check if user already reacted with this icon -> if yes, toggle off (delete)
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('icon_name', iconName)
      .maybeSingle();

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      return NextResponse.json({ toggled: 'removed', iconName });
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        icon_name: iconName,
      });
      return NextResponse.json({ toggled: 'added', iconName });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
