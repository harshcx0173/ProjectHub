import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_MIME_TYPES, uploadRequestSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasUploadPerm = await checkUserPermission(user.id, 'file.upload');
    if (!hasUploadPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing file.upload permission' }, { status: 403 });
    }

    const body = await request.json();
    const validated = uploadRequestSchema.parse(body);

    const typeConfig = ALLOWED_MIME_TYPES[validated.contentType];
    if (!typeConfig) {
      return NextResponse.json({ error: 'UNSUPPORTED_MEDIA_TYPE', message: 'File type not allowed' }, { status: 415 });
    }

    if (validated.sizeBytes > typeConfig.maxSize) {
      return NextResponse.json(
        {
          error: 'FILE_TOO_LARGE',
          message: `File exceeds maximum allowed size of ${typeConfig.maxSize / (1024 * 1024)} MB`,
        },
        { status: 413 }
      );
    }

    // Generate safe storage path: {projectId}/{randomUUID}.{ext}
    const fileId = crypto.randomUUID();
    const storagePath = `${validated.projectId}/${fileId}.${typeConfig.ext}`;
    const bucketName = process.env.STORAGE_BUCKET_NAME || 'project-files';

    // Generate presigned upload URL from Supabase Storage
    const { data: uploadData, error: storageErr } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath);

    if (storageErr || !uploadData) {
      return NextResponse.json(
        { error: 'STORAGE_ERROR', message: storageErr?.message || 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    // Insert metadata record in files table
    const { data: fileRecord, error: fileInsertErr } = await supabase
      .from('files')
      .insert({
        id: fileId,
        project_id: validated.projectId,
        task_id: validated.taskId || null,
        message_id: validated.messageId || null,
        uploader_id: user.id,
        file_name: validated.originalName,
        storage_path: storagePath,
        storage_provider: 'supabase',
        content_type: validated.contentType,
        size_bytes: validated.sizeBytes,
        category: typeConfig.category,
      })
      .select()
      .single();

    if (fileInsertErr) {
      return NextResponse.json({ error: 'DB_ERROR', message: fileInsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      file: fileRecord,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'VALIDATION_ERROR', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
