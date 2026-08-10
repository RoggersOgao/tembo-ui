import { db } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { sessionId, duration, ip, country, region, city, deviceType, browser, os, referrer } = await req.json();

        if (!sessionId || typeof duration !== "number") {
            return NextResponse.json({ error: "Missing sessionId or duration" }, { status: 400 });
        }

        await db.analyticsSession.create({
            data: {
                sessionId,
                duration,
                ip,
                country,
                region,
                city,
                deviceType,
                browser,
                os,
                referrer,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("analytics/session POST error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}