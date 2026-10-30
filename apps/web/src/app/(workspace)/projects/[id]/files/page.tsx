'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Volume2,
  Film,
  Download,
  Upload,
  Calendar,
  AlertCircle,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ProjectFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = async () => {
    try {
      const url = category === 'all'
        ? `/api/v1/projects/${projectId}/files`
        : `/api/v1/projects/${projectId}/files?category=${category}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load project files');
      const data = await res.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [projectId, category]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const presignRes = await fetch('/api/v1/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.message || 'File upload not permitted');
      }

      const { uploadUrl } = await presignRes.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      await fetchFiles();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'image':
        return <ImageIcon className="h-5 w-5 text-blue-500" />;
      case 'audio':
        return <Volume2 className="h-5 w-5 text-purple-500" />;
      case 'recording':
        return <Film className="h-5 w-5 text-amber-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 max-w-6xl mx-auto w-full">
      {/* Header & Upload Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Project Files</h1>
          <p className="text-xs text-gray-500 mt-1">
            Documents, images, audio recordings, and attachments stored securely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-3 mb-6">
        {[
          { key: 'all', label: 'All Files' },
          { key: 'image', label: 'Images' },
          { key: 'document', label: 'Documents' },
          { key: 'audio', label: 'Audio & Voice' },
          { key: 'recording', label: 'Recordings' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              category === tab.key
                ? 'bg-primary/10 text-primary'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-16 text-center text-xs text-gray-400">Loading files...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-xs flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-white">
            <FolderOpen className="h-10 w-10 text-gray-300" />
            <span className="font-semibold text-gray-700">No files found</span>
            <span>Upload files or attachments to share them with the team.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-border bg-white p-3.5 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                      {getCategoryIcon(f.category)}
                    </div>
                    {f.downloadUrl && (
                      <a
                        href={f.downloadUrl}
                        download={f.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <h3 className="text-xs font-semibold text-gray-900 truncate mb-1" title={f.fileName}>
                    {f.fileName}
                  </h3>

                  <div className="text-[11px] text-gray-400 space-y-0.5">
                    <p>{(f.sizeBytes / 1024).toFixed(1)} KB</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(f.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Inline audio player if audio */}
                {f.category === 'audio' && f.downloadUrl && (
                  <audio controls className="w-full mt-3 h-8">
                    <source src={f.downloadUrl} type={f.contentType} />
                  </audio>
                )}

                {/* Inline thumbnail if image */}
                {f.category === 'image' && f.downloadUrl && (
                  <div className="mt-3 h-28 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                    <img
                      src={f.downloadUrl}
                      alt={f.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
