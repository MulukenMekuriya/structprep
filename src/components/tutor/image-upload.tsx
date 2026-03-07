"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, FileText } from "lucide-react";

export interface ImageAttachment {
  id: string;
  file: File;
  preview: string; // data URL for preview
  base64: string; // base64 string (no prefix) for API
  type: string; // mime type
}

interface ImageUploadButtonProps {
  onImagesAdded: (images: ImageAttachment[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part after the data URL prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUploadButton({
  onImagesAdded,
  disabled,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const attachments: ImageAttachment[] = [];

      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) continue;
        if (file.size > MAX_FILE_SIZE) continue;

        const base64 = await fileToBase64(file);
        const preview = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : ""; // PDFs don't get visual preview

        attachments.push({
          id: crypto.randomUUID(),
          file,
          preview,
          base64,
          type: file.type,
        });
      }

      if (attachments.length > 0) {
        onImagesAdded(attachments);
      }
    },
    [onImagesAdded]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // reset so same file can be selected again
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-[60px] w-10 shrink-0 text-muted-foreground hover:text-foreground"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Upload image or document"
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </>
  );
}

interface ImagePreviewBarProps {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
}

export function ImagePreviewBar({ images, onRemove }: ImagePreviewBarProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 px-1 pb-2 overflow-x-auto">
      {images.map((img) => (
        <div
          key={img.id}
          className="relative group shrink-0 rounded-lg border bg-muted/50 overflow-hidden"
        >
          {img.preview ? (
            <img
              src={img.preview}
              alt={img.file.name}
              className="h-20 w-20 object-cover"
            />
          ) : (
            <div className="h-20 w-20 flex flex-col items-center justify-center gap-1 px-1">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {img.file.name}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (img.preview) URL.revokeObjectURL(img.preview);
              onRemove(img.id);
            }}
            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
