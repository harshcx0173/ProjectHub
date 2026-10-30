/**
 * Client-side avatar image processing:
 * 1. Resizes image to maximum 256x256 pixels maintaining aspect ratio.
 * 2. Renders via 2D HTML Canvas, which naturally strips EXIF, geolocation, and device metadata.
 * 3. Compresses to WebP/JPEG format.
 */
export async function sanitizeAndResizeAvatar(
  file: File,
  maxDimension: number = 256,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      // Draw onto canvas - this discards all EXIF and metadata
      ctx.drawImage(img, 0, 0, width, height);

      // Output as sanitized WebP or JPEG blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate sanitized image blob'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing'));
    };

    img.src = objectUrl;
  });
}

