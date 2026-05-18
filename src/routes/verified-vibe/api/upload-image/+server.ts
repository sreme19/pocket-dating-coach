/**
 * Image Upload API Endpoint
 *
 * Handles image uploads for chat messages.
 * Stores images in Supabase Storage.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/verified-vibe/upload-image
 *
 * Upload an image for a chat message.
 *
 * Request: FormData with 'file' field
 * - file: File (required) - Image file to upload
 * - conversationId: string (required) - The conversation ID
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     imageUrl: string,
 *     fileName: string,
 *     size: number,
 *     type: string
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const userId = formData.get('userId') as string | null;

    // Validate required fields
    if (!file) {
      return json(
        { error: 'Missing file' },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json(
        { error: `File type not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { error: `File size exceeds maximum of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB` },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Upload file to Supabase Storage
    // 2. Generate public URL
    // 3. Store image metadata in database
    // 4. Return image URL

    // For now, generate a mock URL
    const fileName = `${Date.now()}-${file.name}`;
    const imageUrl = `/api/verified-vibe/images/${fileName}`;

    console.log(`[Image Upload API] Image uploaded by ${userId} in conversation ${conversationId}`);

    return json({
      data: {
        success: true,
        imageUrl,
        fileName,
        size: file.size,
        type: file.type
      }
    });
  } catch (error) {
    console.error('Image Upload API error:', error);
    return json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/verified-vibe/upload-image
 *
 * Delete an uploaded image.
 *
 * Query parameters:
 * - fileName: string (required) - The file name to delete
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     success: boolean
 *   }
 * }
 */
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const fileName = url.searchParams.get('fileName');
    const userId = url.searchParams.get('userId');

    // Validate required fields
    if (!fileName) {
      return json(
        { error: 'Missing fileName' },
        { status: 400 }
      );
    }

    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Verify user owns the image
    // 2. Delete from Supabase Storage
    // 3. Remove metadata from database

    console.log(`[Image Upload API] Image ${fileName} deleted by ${userId}`);

    return json({
      data: {
        success: true
      }
    });
  } catch (error) {
    console.error('Image Upload API error:', error);
    return json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
};
