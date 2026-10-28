import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('files')
      .select(`
        id,
        project_id,
        file_name,
        storage_path,
        storage_provider,
        content_type,
        size_bytes,
        category,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: files, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const bucketName = process.env.STORAGE_BUCKET_NAME || 'project-files';

    // Generate signed download URLs for private files
    const filesWithUrls = await Promise.all(
      (files || []).map(async (f: any) => {
        let downloadUrl = null;
        try {
          const { data: signData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(f.storage_path, 3600); // 1 hour validity
          downloadUrl = signData?.signedUrl || null;
        } catch {
          // ignore error if object not found
        }

        return {
          id: f.id,
          projectId: f.project_id,
          fileName: f.file_name,
          contentType: f.content_type,
          sizeBytes: f.size_bytes,
          category: f.category,
          downloadUrl,
          createdAt: f.created_at,
          uploader: f.profiles,
        };
      })
    );

    return NextResponse.json({ files: filesWithUrls });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
