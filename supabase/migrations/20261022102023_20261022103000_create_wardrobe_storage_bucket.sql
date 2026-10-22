/*
# Create private wardrobe storage bucket

1. New storage resource
- Create the `wardrobe` bucket used for clothing photos.
- Keep the bucket private so images are never publicly accessible.
- Limit uploads to common image formats and 15 MB per file.

2. Security
- The existing `storage.objects` policies restrict reads, uploads, updates, and deletes to the signed-in owner whose user ID is the first folder in the file path.
- The bucket is configured as private and is accessed by the application through signed URLs.

3. Important notes
- This migration is idempotent and can safely be applied again.
- Existing files are not modified or deleted.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wardrobe',
  'wardrobe',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;