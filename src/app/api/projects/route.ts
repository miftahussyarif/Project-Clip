import { NextRequest, NextResponse } from 'next/server';
import { getProcessedClipsGroupedByProject, getProjects, deleteProject } from '@/lib/video/processor';

// GET - List all projects with their clips
export async function GET() {
    try {
        const data = await getProcessedClipsGroupedByProject();

        return NextResponse.json({
            success: true,
            data: {
                projects: data.projects,
                uncategorizedClips: data.uncategorizedClips,
            },
        });
    } catch (error) {
        console.error('Error listing projects:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a project (clips become uncategorized)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { success: false, error: 'Project ID is required' },
                { status: 400 }
            );
        }

        await deleteProject(projectId);

        return NextResponse.json({
            success: true,
            message: 'Project deleted successfully. Clips are now uncategorized.',
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
