import { createHash } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { createPublicRpcClient } from "@/lib/supabase/public-rpc";
const schema=z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{40,60}$/)}).strict();
export async function POST(request:NextRequest){
  if(request.headers.get("origin")!==request.nextUrl.origin) return NextResponse.json({error:"Cross-origin request rejected."},{status:403});
  if(Number(request.headers.get("content-length")||0)>2048) return NextResponse.json({error:"Request too large."},{status:413});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success) return NextResponse.json({error:"Invalid or missing pairing challenge."},{status:400});
  const supabase=createPublicRpcClient();
  if(!supabase) return NextResponse.json({error:"Pairing service is not configured."},{status:503});
  const hash=createHash("sha256").update(parsed.data.challenge,"utf8").digest("hex");
  const {data,error}=await supabase.rpc("claim_pairing_challenge",{p_secret_hash:hash});
  if(error) return NextResponse.json({error:"Pairing could not be checked. Please retry."},{status:503});
  if(data!==true) return NextResponse.json({error:"This QR code is invalid, expired or already used."},{status:410});
  return NextResponse.json({accepted:true},{headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}});
}
