import { NextResponse } from "next/server";
import { Agent } from "undici";

const BASE_URL = (process.env.PS365_API_BASE || "").replace(/\/$/, "");

const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

export async function POST(req) {
    try {
        const { username } = await req.json();
        if (!username) {
            return NextResponse.json({ message: "Username is required." }, { status: 400 });
        }

        const url = `${BASE_URL}/list_user_active_companies?user_name_365=${encodeURIComponent(username)}`;
        const response = await fetch(url, { method: 'GET', dispatcher });
        const data = await response.json();

        if (data?.api_response?.response_code !== "1") {
            throw new Error(data?.api_response?.response_msg || "Failed to fetch companies.");
        }
        
        const companies = data.list_user_active_companies || [];
        // Map to a cleaner format if needed, e.g., { id, name }
        const formattedCompanies = companies.map(c => ({
            id: c.company_code_365,
            name: c.company_name_365
        }));

        return NextResponse.json(formattedCompanies);

    } catch (error) {
        console.error("[Companies API Error]", error);
        return NextResponse.json({ message: error.message || "An unexpected server error occurred." }, { status: 500 });
    }
}