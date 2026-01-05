import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

/**
 * GET - Check cookie file status
 */
export async function GET() {
    try {
        const stats = await fs.stat(COOKIES_FILE);
        return NextResponse.json({
            success: true,
            data: {
                exists: true,
                size: stats.size,
                lastModified: stats.mtime.toISOString(),
            },
        });
    } catch {
        return NextResponse.json({
            success: true,
            data: {
                exists: false,
                size: 0,
                lastModified: null,
            },
        });
    }
}

/**
 * POST - Save cookies content to file
 */
export async function POST(request: NextRequest) {
    try {
        const { cookies } = await request.json();

        if (!cookies || typeof cookies !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Cookies content is required' },
                { status: 400 }
            );
        }

        // Basic validation - check for Netscape format header or cookie content
        const isValidFormat = cookies.includes('.youtube.com') ||
            cookies.includes('# Netscape HTTP Cookie File') ||
            cookies.includes('youtube.com');

        if (!isValidFormat) {
            return NextResponse.json(
                { success: false, error: 'Invalid cookie format. Make sure to export in Netscape format from Cookie Editor.' },
                { status: 400 }
            );
        }

        await fs.writeFile(COOKIES_FILE, cookies, 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'Cookies saved successfully',
        });
    } catch (error) {
        console.error('Error saving cookies:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save cookies' },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Remove cookies file
 */
export async function DELETE() {
    try {
        await fs.unlink(COOKIES_FILE);
        return NextResponse.json({
            success: true,
            message: 'Cookies deleted successfully',
        });
    } catch (error) {
        // File might not exist
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return NextResponse.json({
                success: true,
                message: 'Cookies file does not exist',
            });
        }
        console.error('Error deleting cookies:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete cookies' },
            { status: 500 }
        );
    }
}
