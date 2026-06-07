import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";
import type { ExtractedSubmission, WeeklySubmission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const { ids, uploadId } = await req.json();
    
    // Get the drafts to approve
    let filter: any = {};
    if (ids && ids.length > 0) {
      filter = { _id: { $in: ids } };
    } else if (uploadId) {
      filter = { 
        uploadId, 
        reviewed: true,
        "validation.status": { $ne: "error" }
      };
    } else {
      return NextResponse.json({ error: "Must provide ids or uploadId" }, { status: 400 });
    }
    
    const drafts = await db
      .collection(COLLECTIONS.extractedSubmissions)
      .find(filter)
      .toArray() as unknown as ExtractedSubmission[];
    
    if (drafts.length === 0) {
      return NextResponse.json({ error: "No valid submissions to approve" }, { status: 400 });
    }
    
    // Convert drafts to submissions
    const submissions: WeeklySubmission[] = drafts.map((draft) => ({
      _id: uid("ws"),
      personId: draft.personId,
      personName: draft.personName,
      department: draft.department,
      teamLead: draft.teamLead,
      week: draft.week,
      submittedAt: new Date().toISOString(),
      topPriority: draft.topPriority,
      actions: draft.actions,
      outcomes: draft.outcomes,
      blockers: draft.blockers,
      notes: draft.notes,
    }));
    
    // Insert into weekly_submissions
    await db.collection(COLLECTIONS.submissions).insertMany(submissions as any[]);
    
    // Delete the approved drafts
    await db.collection(COLLECTIONS.extractedSubmissions).deleteMany({ 
      _id: { $in: drafts.map((d) => d._id) } 
    } as any);
    
    // Update the upload status
    if (uploadId) {
      const remaining = await db
        .collection(COLLECTIONS.extractedSubmissions)
        .countDocuments({ uploadId });
      
      if (remaining === 0) {
        await db.collection(COLLECTIONS.uploads).updateOne(
          { _id: uploadId },
          { $set: { status: "approved" } }
        );
      } else {
        await db.collection(COLLECTIONS.uploads).updateOne(
          { _id: uploadId },
          { $set: { status: "partial" } }
        );
      }
    }
    
    return NextResponse.json({ 
      approved: submissions.length,
      submissions 
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
