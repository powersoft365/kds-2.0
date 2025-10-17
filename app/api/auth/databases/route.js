import { NextResponse } from "next/server";
import { Agent } from "undici";

const BASE_URL = (process.env.PS365_API_BASE || "").replace(/\/$/, "");

const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

export async function POST(req) {
    try {
        const { username, companyId } = await req.json();

        if (!username || !companyId) {
            return NextResponse.json({ message: "Username and Company ID are required." }, { status: 400 });
        }

        const url = `${BASE_URL}/list_company_active_databases?company_code_365=${encodeURIComponent(companyId)}&user_name_365=${encodeURIComponent(username)}`;
        const response = await fetch(url, { method: 'GET', dispatcher });
        const data = await response.json();
        
        if (data?.api_response?.response_code !== "1") {
            throw new Error(data?.api_response?.response_msg || `Failed to fetch databases for company ${companyId}.`);
        }
        
        const databases = data.list_company_databases || [];
        const formattedDatabases = databases.map(db => ({
            id: db.database_code_365,
            name: db.database_name_365
        }));

        return NextResponse.json(formattedDatabases);

    } catch (error) {
        console.error("[Databases API Error]", error);
        return NextResponse.json({ message: error.message || "An unexpected server error occurred." }, { status: 500 });
    }
}