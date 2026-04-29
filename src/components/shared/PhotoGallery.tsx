'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X, Maximize2, Trash2 } from 'lucide-react';

interface PhotoGalleryProps {
  /** Bucket name in Supabase Storage */
  bucket: string;
  /** Folder path inside the bucket (sin trailing slash). Ej: `instalaciones/abc-123` */
  folderPath: string;
  /** Array de paths actuales (relativos al bucket) */
  paths: string[];
  /** Callback cuando cambia el array de paths */
  onChange: (paths: string[]) => void;
  /** Si false, solo muestra fotos sin permitir subir/eliminar */
  editable?: boolean;
  /** Máximo de fotos permitidas */
  max?: number;
  /** Tamaño máximo por archivo en MB */
  maxSizeMB?: number;
}

/**
 * Galería de fotos con uploader integrado a Supabase Storage.
 *
 * - Sube imágenes a un bucket de Storage
 * - Guarda los paths relativos en `paths` (vía onChange)
 * - Muestra grid de previews con botón de eliminar
 * - Click en foto = abrir lightbox
 */
export default function PhotoGallery({
  bucket,
  folderPath,
  paths,
  onChange,
  editable = true,
  max = 10,
  maxSizeMB = 5,
}: PhotoGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const getPublicUrl = (path: string): string => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (paths.length + files.length > max) {
      toast.error(`Máximo ${max} fotos permitidas (tienes ${paths.length})`);
      return;
    }

    setUploading(true);
    const uploadedPaths: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validar tamaño
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`"${file.name}" supera ${maxSizeMB}MB`);
          continue;
        }
        // Validar tipo
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" no es una imagen`);
          continue;
        }

        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const fullPath = `${folderPath}/${fileName}`;

        const { error } = await supabase.storage
          .from(bucket)
          .upload(fullPath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          toast.error(`Error subiendo ${file.name}: ${error.message}`);
          continue;
        }
        uploadedPaths.push(fullPath);
      }

      if (uploadedPaths.length > 0) {
        onChange([...paths, ...uploadedPaths]);
        toast.success(`${uploadedPaths.length} foto${uploadedPaths.length > 1 ? 's' : ''} subida${uploadedPaths.length > 1 ? 's' : ''}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(path: string) {
    if (!confirm('¿Eliminar esta foto?')) return;

    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
      return;
    }
    onChange(paths.filter((p) => p !== path));
    toast.success('Foto eliminada');
  }

  return (
    <div className="space-y-2">
      {/* Grid de fotos */}
      {paths.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {paths.map((path) => {
            const url = getPublicUrl(path);
            return (
              <div
                key={path}
                className="relative aspect-square rounded-lg overflow-hidden bg-[#1C2333] border border-[#1F2937] group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Foto"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setLightbox(url)}
                    className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
                    title="Ver tamaño completo"
                  >
                    <Maximize2 size={14} />
                  </button>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => handleDelete(path)}
                      className="p-1.5 rounded-md bg-red-600/80 text-white hover:bg-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add button como tile */}
          {editable && paths.length < max && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-[#1F2937] hover:border-blue-500/50 bg-[#0F1725] hover:bg-[#1C2333] flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <ImagePlus size={20} />
                  <span className="text-[10px]">Agregar</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {paths.length === 0 && editable && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full p-6 rounded-lg border-2 border-dashed border-[#1F2937] hover:border-blue-500/50 bg-[#0F1725] hover:bg-[#1C2333] flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 size={28} className="animate-spin" />
          ) : (
            <>
              <ImagePlus size={28} />
              <div className="text-sm font-medium">Subir fotos</div>
              <div className="text-[11px] text-gray-600">Hasta {max} fotos · {maxSizeMB}MB cada una</div>
            </>
          )}
        </button>
      )}

      {paths.length === 0 && !editable && (
        <div className="text-sm text-gray-600 italic py-4 text-center">
          Sin fotos
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Counter */}
      {paths.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>{paths.length} / {max} fotos</span>
          {editable && paths.length < max && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              + Agregar más
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
