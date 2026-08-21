import { useCallback, useRef, useState } from 'react';
import { Upload, X, ImagePlus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const mimeType = hasAlpha ? 'image/webp' : 'image/jpeg';
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, 0.82);
  });
  return new File([blob], file.name.replace(/\.\w+$/, hasAlpha ? '.webp' : '.jpg'), { type: mimeType });
}

export function ImageUploader({
  value,
  onChange,
  label = 'อัปโหลดรูปภาพ',
  folder = 'products',
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('รองรับเฉพาะไฟล์ .jpg, .png, .webp เท่านั้น');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`ไฟล์ใหญ่เกิน 5MB (ขนาดไฟล์ ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        return;
      }
      setUploading(true);
      try {
        const compressed = await compressImage(file);
        const ext = compressed.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, compressed, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        onChange(urlData.publicUrl);
      } catch (err: any) {
        setError(err.message ?? 'อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally {
        setUploading(false);
      }
    },
    [folder, onChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const remove = useCallback(() => onChange(''), [onChange]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="block text-sm font-medium text-surface-700">{label}</label>}
      {value ? (
        <div className="relative group">
          <div
            className="w-full h-40 rounded-xl border border-surface-200 overflow-hidden flex items-center justify-center"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
            }}
          >
            <img src={value} alt="preview" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={remove}
              className="p-1.5 rounded-lg bg-surface-900/70 text-white hover:bg-surface-900 transition-colors"
              title="ลบรูป"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors flex items-center gap-1.5"
          >
            <ImagePlus className="w-3.5 h-3.5" /> เปลี่ยนรูป
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
            dragOver
              ? 'border-primary-500 bg-primary-50'
              : 'border-surface-300 hover:border-primary-400 hover:bg-surface-50',
          )}
        >
          {uploading ? (
            <>
              <span className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-sm text-surface-500">กำลังอัปโหลด...</p>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-surface-400" />
              <p className="text-sm text-surface-500">คลิกหรือลากไฟล์มาวางที่นี่</p>
              <p className="text-xs text-surface-400">รองรับ .jpg, .png, .webp (ไม่เกิน 5MB)</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-error-600 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
